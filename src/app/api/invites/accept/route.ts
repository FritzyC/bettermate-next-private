import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

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

async function acceptInviteRpc(client: any, token: string, userId: string) {
  // DB has overloads:
  //   accept_invite(p_token text) returns jsonb
  //   accept_invite(p_token text, p_user_id uuid) returns jsonb
  const attempts: Array<{ attempt: string; params: Record<string, any> }> = [
    { attempt: 'p_token+p_user_id', params: { p_token: token, p_user_id: userId } },
    { attempt: 'p_token_only', params: { p_token: token } },
  ];

  let lastErr: any = null;
  let lastAttempt = 'none';

  for (const a of attempts) {
    // Cast to any to avoid TS thinking this function takes undefined args
    const { data, error } = await (client as any).rpc('accept_invite', a.params);
    if (!error) return { data, error: null, attempt: a.attempt };
    lastErr = error;
    lastAttempt = a.attempt;

    // Signature mismatch => try next overload
    if (error?.code === 'PGRST202') continue;

    // Otherwise stop early (real business/permission error)
    break;
  }

  return { data: null, error: lastErr, attempt: lastAttempt };
}

export async function POST(req: NextRequest) {
  const debug = process.env.NEXT_PUBLIC_BM_DEBUG === '1';

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const publicKey =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() ||
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();

  if (!supabaseUrl || !publicKey) {
    return json({ error: 'missing_supabase_public_env' }, 500);
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

  // Use public key + user bearer (no service role required)
  const client = createClient<any>(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  // Validate bearer and get user id (explicit token)
  const { data: u, error: uErr } = await client.auth.getUser(bearer);
  const user = u?.user;

  if (uErr || !user?.id) {
    return json(
      {
        error: 'unauthorized',
        detail: debug ? (uErr?.message || 'Auth session missing!') : 'unauthorized',
        cookie_names: [],
        bearer_present: true,
      },
      401
    );
  }

  const userId = user.id;

  const { data: rpcData, error: rpcErr, attempt } = await acceptInviteRpc(client, token, userId);

  if (rpcErr) {
    return json(
      {
        error: 'rpc_error',
        detail: debug
          ? { code: rpcErr?.code ?? null, message: rpcErr?.message ?? String(rpcErr), hint: rpcErr?.hint ?? null, details: rpcErr?.details ?? null }
          : 'rpc_error',
        code: rpcErr?.code ?? null,
        attempt: debug ? attempt : undefined,
      },
      500
    );
  }

  // Normalize return
  const matchId =
    typeof rpcData === 'string'
      ? rpcData
      : rpcData?.match_id ?? rpcData?.matchId ?? null;

  const inviteId =
    rpcData?.invite_id ?? rpcData?.inviteId ?? null;

  const idempotent = Boolean(rpcData?.idempotent);

  if (!matchId) {
    return json({ error: 'unexpected_rpc_shape', detail: debug ? rpcData : null }, 500);
  }

  // Best-effort behavior log (do not fail accept if insert fails)
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
  } catch {}

  return json({ ok: true, match_id: matchId, invite_id: inviteId, idempotent });
}

export async function GET() {
  return json({ error: 'method_not_allowed' }, 405);
}
