import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function isNonEmptyString(v: any): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function getBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function acceptInviteRpc(
  client: ReturnType<typeof createClient>,
  token: string,
  userId: string,
  debug: boolean
): Promise<{ data: any; error: any; attempt: string }> {
  // Your DB has:
  // 1) accept_invite(p_token text)
  // 2) accept_invite(p_token text, p_user_id uuid)
  //
  // Prefer the explicit-user variant first, then fallback to p_token-only.
  const attempts: Array<{ attempt: string; params: Record<string, any> }> = [
    { attempt: 'p_token+p_user_id', params: { p_token: token, p_user_id: userId } },
    { attempt: 'p_token_only', params: { p_token: token } },
  ];

  let last: any = null;
  let lastAttempt = 'none';

  for (const a of attempts) {
    const { data, error } = await client.rpc('accept_invite', a.params);
    if (!error) return { data, error: null, attempt: a.attempt };
    last = error;
    lastAttempt = a.attempt;

    // If PostgREST says function signature mismatch, try the next overload.
    if (error?.code === 'PGRST202') continue;

    // Otherwise stop early; it's a real DB/permission/business error.
    break;
  }

  if (debug) {
    return {
      data: null,
      error: {
        code: last?.code ?? null,
        message: last?.message ?? String(last),
        hint: last?.hint ?? null,
        details: last?.details ?? null,
      },
      attempt: lastAttempt,
    };
  }

  return { data: null, error: last, attempt: lastAttempt };
}

export async function POST(req: NextRequest) {
  const debug = process.env.NEXT_PUBLIC_BM_DEBUG === '1';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (!isNonEmptyString(supabaseUrl) || !isNonEmptyString(publicKey)) {
    return json(
      {
        error: 'missing_supabase_public_env',
        detail: debug ? 'Missing NEXT_PUBLIC_SUPABASE_URL or public key' : null,
      },
      500
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request', detail: 'invalid_json' }, 400);
  }

  const token = body?.token;
  if (!isNonEmptyString(token)) {
    return json({ error: 'bad_request', detail: 'missing_token' }, 400);
  }

  const bearer = getBearer(req);
  if (!bearer) {
    return json(
      { error: 'unauthorized', detail: 'Auth session missing!', cookie_names: [], bearer_present: false },
      401
    );
  }

  // IMPORTANT:
  // - publicKey is ALWAYS used as apikey
  // - bearer is ONLY used as Authorization: Bearer <access_token>
  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  // Validate bearer and identify user
  const { data: userData, error: userErr } = await client.auth.getUser();
  const user = userData?.user;

  if (userErr || !user?.id) {
    return json(
      {
        error: 'unauthorized',
        detail: userErr?.message || 'Auth session missing!',
        cookie_names: [],
        bearer_present: true,
      },
      401
    );
  }

  const userId = user.id;

  // Call the correct accept_invite overload
  const { data: rpcData, error: rpcErr, attempt } = await acceptInviteRpc(client, token, userId, debug);

  if (rpcErr) {
    return json(
      {
        error: 'rpc_error',
        detail: debug ? rpcErr : 'rpc_error',
        code: debug ? (rpcErr?.code ?? null) : null,
        attempt: debug ? attempt : undefined,
      },
      500
    );
  }

  // Normalize return shapes
  let matchId: string | null = null;
  let inviteId: string | null = null;
  let idempotent = false;

  if (typeof rpcData === 'string') {
    matchId = rpcData;
  } else if (rpcData && typeof rpcData === 'object') {
    matchId = rpcData.match_id ?? rpcData.matchId ?? null;
    inviteId = rpcData.invite_id ?? rpcData.inviteId ?? null;
    idempotent = Boolean(rpcData.idempotent);
  }

  if (!matchId) {
    return json({ error: 'unexpected_rpc_shape', detail: debug ? rpcData : null }, 500);
  }

  // Best-effort behavior logging (do not fail accept if insert fails)
  try {
    const dedup_key = `invite_accept:${userId}:${token}`;
    await client.from('behavior_events').insert({
      dedup_key,
      event_type: 'invite_accept',
      source: 'api',
      created_at: new Date().toISOString(),
      user_id: userId,
      invite_id: inviteId,
      match_id: matchId,
      metadata: { token_prefix: token.slice(0, 8), token_len: token.length },
    });
  } catch {
    // ignore
  }

  return json({ ok: true, match_id: matchId, invite_id: inviteId, idempotent });
}

export async function GET() {
  return json({ error: 'method_not_allowed' }, 405);
}
