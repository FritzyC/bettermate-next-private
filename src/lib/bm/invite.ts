import { createClient } from "@supabase/supabase-js";

/**
 * BetterMate Invite helpers (client-side)
 *
 * Primary goal: stop "invalid_token" loops by ensuring we ALWAYS send the real token
 * using the field names the server route can parse.
 *
 * This file is intentionally:
 * - idempotent-friendly (caller can retry)
 * - session-safe (anon client with persistSession:false for preview)
 * - compatible with existing UI usage that calls acceptInvite({ token, accessToken })
 */

export type AcceptInviteResponse =
  | {
      ok: true;
      match_id: string;
      matchId: string;
      idempotent?: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      status?: number;
      details?: any;
    };

export type InvitePreviewResponse =
  | { ok: true; invite: any }
  | { ok: false; error: string; code?: string; status?: number };

function env(name: string): string {
  const v = (process.env as any)[name];
  if (!v || typeof v !== "string") throw new Error(`missing_env_${name}`);
  return v;
}

/**
 * Anonymous Supabase client for preview RPC only.
 * IMPORTANT: persistSession:false avoids GoTrue storage collisions.
 */
function getAnonNoSessionClient() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function safeJson(resp: Response): Promise<any> {
  const ct = resp.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Accept an invite via server route (accept-after-auth).
 * Caller typically provides { token, accessToken } (from supabase.auth.getSession()).
 *
 * NOTE: We send token under multiple keys to prevent mismatches:
 *  - token (preferred)
 *  - p_token (for Postgres fn param naming)
 *  - code (legacy callers)
 */
export async function acceptInvite(args: {
  token: string;
  accessToken?: string | null;
}): Promise<AcceptInviteResponse> {
  const token = typeof args?.token === "string" ? args.token.trim() : "";
  const accessToken =
    typeof args?.accessToken === "string" ? args.accessToken.trim() : null;

  if (!token) {
    return { ok: false, error: "invalid_token", code: "invalid_token", status: 400 };
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (accessToken) headers["authorization"] = `Bearer ${accessToken}`;

  const resp = await fetch("/api/invites/accept", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ token, p_token: token, code: token }),
  });

  const json = await safeJson(resp);

  if (!resp.ok) {
    const code = (json?.code || json?.error || `http_${resp.status}`) as string;
    return { ok: false, error: code, code, status: resp.status, details: json };
  }

  if (json?.ok === true && typeof json?.match_id === "string") {
    return {
      ok: true,
      match_id: json.match_id,
      matchId: json.match_id,
      idempotent: !!json.idempotent,
    };
  }

  // Defensive: if server returns ok:false with 200 (should not, but handle)
  if (json?.ok === false) {
    const code = (json?.code || json?.error || "accept_failed") as string;
    return { ok: false, error: code, code, status: 400, details: json };
  }

  return { ok: false, error: "unexpected_response", code: "unexpected_response", status: 500, details: json };
}

/**
 * Preview invite details via RPC get_invite_preview(token)
 * Used by invite page before auth.
 */
export async function getInvitePreview(token: string): Promise<InvitePreviewResponse> {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return { ok: false, error: "invalid_token", code: "invalid_token", status: 400 };

  try {
    const supabase = getAnonNoSessionClient();
    const { data, error } = await supabase.rpc("get_invite_preview", { token: t });

    if (error) {
      return { ok: false, error: "rpc_error", code: "rpc_error", status: 500 };
    }

    // The RPC is expected to return { ok:true, ... } or { error:"..." }
    if (data?.ok === true) return { ok: true, invite: data };
    if (typeof data?.error === "string") return { ok: false, error: data.error, code: data.error, status: 400 };

    return { ok: false, error: "unexpected_response", code: "unexpected_response", status: 500 };
  } catch {
    return { ok: false, error: "client_error", code: "client_error", status: 500 };
  }
}
