/**
 * Invite helpers
 * - Preview: GET /api/invites/preview?token=...
 * - Accept:  POST /api/invites/accept  {token}
 *
 * Critical: Accept must include Authorization: Bearer <access_token> whenever user is logged in.
 * Supabase session storage shapes vary (legacy/new). This file robustly finds and refreshes access tokens.
 */

export type InvitePreview =
  | {
      inviter_name: string;
      channel: string;
      status: string;
      [k: string]: any;
    }
  | { error: string; [k: string]: any };

type SessionLike = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // seconds since epoch
  expires_in?: number;
  token_type?: string;
  user?: any;
};

type FoundAuth = {
  storage_key: string;
  raw: any; // parsed JSON object from localStorage
  wrapper: 'direct' | 'session' | 'currentSession' | 'data.session';
  session: SessionLike;
};

function getPublicEnv() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() ||
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
  return { url, key };
}

function safeJsonParse(s: string | null): any | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractSession(raw: any): { wrapper: FoundAuth['wrapper']; session: SessionLike } | null {
  if (!raw || typeof raw !== 'object') return null;

  // Common shapes:
  // 1) direct session: { access_token, refresh_token, ... }
  if (typeof raw.access_token === 'string') return { wrapper: 'direct', session: raw as SessionLike };

  // 2) { session: { access_token... } }
  if (raw.session && typeof raw.session.access_token === 'string') {
    return { wrapper: 'session', session: raw.session as SessionLike };
  }

  // 3) { currentSession: { access_token... } } (seen in some wrappers)
  if (raw.currentSession && typeof raw.currentSession.access_token === 'string') {
    return { wrapper: 'currentSession', session: raw.currentSession as SessionLike };
  }

  // 4) { data: { session: { access_token... } } }
  if (raw.data?.session && typeof raw.data.session.access_token === 'string') {
    return { wrapper: 'data.session', session: raw.data.session as SessionLike };
  }

  return null;
}

function findAuth(): FoundAuth | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;

  // Prefer canonical key if present: sb-<projectRef>-auth-token
  // Your project ref: ukxraiiwgiroiqxtyiml
  const preferred = `sb-ukxraiiwgiroiqxtyiml-auth-token`;
  const preferredRaw = safeJsonParse(localStorage.getItem(preferred));
  const preferredExtract = extractSession(preferredRaw);
  if (preferredExtract?.session?.access_token) {
    return {
      storage_key: preferred,
      raw: preferredRaw,
      wrapper: preferredExtract.wrapper,
      session: preferredExtract.session,
    };
  }

  // Otherwise scan all keys that look like Supabase auth storage
  const candidates: FoundAuth[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;

    // Typical: sb-<ref>-auth-token
    // Also allow any key containing "auth-token" to be resilient.
    if (!(k.includes('auth-token'))) continue;

    const raw = safeJsonParse(localStorage.getItem(k));
    const ex = extractSession(raw);
    if (!ex?.session?.access_token) continue;

    candidates.push({
      storage_key: k,
      raw,
      wrapper: ex.wrapper,
      session: ex.session,
    });
  }

  if (candidates.length === 0) return null;

  // Pick the one with the longest access token (heuristic) and/or latest expires_at
  candidates.sort((a, b) => {
    const la = (a.session.access_token || '').length;
    const lb = (b.session.access_token || '').length;
    if (lb !== la) return lb - la;
    const ea = typeof a.session.expires_at === 'number' ? a.session.expires_at : 0;
    const eb = typeof b.session.expires_at === 'number' ? b.session.expires_at : 0;
    return eb - ea;
  });

  return candidates[0];
}

function writeUpdatedSession(found: FoundAuth, next: SessionLike) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  const raw = found.raw && typeof found.raw === 'object' ? found.raw : {};

  if (found.wrapper === 'direct') {
    raw.access_token = next.access_token;
    raw.refresh_token = next.refresh_token;
    raw.expires_in = next.expires_in;
    raw.expires_at = next.expires_at;
    raw.token_type = next.token_type;
    raw.user = next.user;
  } else if (found.wrapper === 'session') {
    raw.session = { ...(raw.session || {}), ...next };
  } else if (found.wrapper === 'currentSession') {
    raw.currentSession = { ...(raw.currentSession || {}), ...next };
  } else if (found.wrapper === 'data.session') {
    raw.data = raw.data || {};
    raw.data.session = { ...(raw.data.session || {}), ...next };
  } else {
    // fallback
    raw.session = { ...(raw.session || {}), ...next };
  }

  try {
    localStorage.setItem(found.storage_key, JSON.stringify(raw));
  } catch {
    // ignore
  }
}

async function refreshAccessToken(found: FoundAuth): Promise<string | null> {
  const refreshToken = found.session.refresh_token;
  if (!refreshToken) return null;

  const { url, key } = getPublicEnv();
  if (!url || !key) return null;

  // GoTrue refresh endpoint
  const endpoint = `${url.replace(/\/+$/, '')}/auth/v1/token?grant_type=refresh_token`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!resp.ok) return null;

  const data = (await resp.json().catch(() => null)) as any;
  const newAccess = typeof data?.access_token === 'string' ? data.access_token : null;
  const newRefresh = typeof data?.refresh_token === 'string' ? data.refresh_token : refreshToken;
  const expiresIn = typeof data?.expires_in === 'number' ? data.expires_in : found.session.expires_in;
  const tokenType = typeof data?.token_type === 'string' ? data.token_type : found.session.token_type;

  if (!newAccess) return null;

  // Prefer expires_at returned by server; else preserve old if present.
  const nextExpiresAt =
    typeof data?.expires_at === 'number'
      ? data.expires_at
      : typeof found.session.expires_at === 'number'
      ? found.session.expires_at
      : undefined;

  writeUpdatedSession(found, {
    access_token: newAccess,
    refresh_token: newRefresh,
    expires_in: expiresIn,
    expires_at: nextExpiresAt,
    token_type: tokenType,
    user: data?.user ?? found.session.user,
  });

  return newAccess;
}

async function postAccept(token: string, accessToken: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch('/api/invites/accept', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function looksExpired(detail: any): boolean {
  const s = String(detail ?? '').toLowerCase();
  return s.includes('token is expired') || s.includes('invalid jwt') || s.includes('expired');
}

export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const res = await fetch(`/api/invites/preview?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return res.json();
}

export async function acceptInvite(token: string): Promise<any> {
  const found = findAuth();
  const initialAccess = found?.session?.access_token ?? null;

  // Attempt 1
  const first = await postAccept(token, initialAccess);

  // If unauthorized due to expired JWT, refresh and retry once
  if (first.status === 401 && looksExpired(first.data?.detail) && found?.session?.refresh_token) {
    const refreshed = await refreshAccessToken(found);
    const second = await postAccept(token, refreshed);
    return second;
  }

  return first;
}
