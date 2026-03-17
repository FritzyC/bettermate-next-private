import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function getBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function getPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
}

export async function POST(req: NextRequest) {
  const debug = process.env.NEXT_PUBLIC_BM_DEBUG === '1';

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const publicKey = getPublicKey();

  if (!supabaseUrl || !publicKey) {
    return json({ error: 'missing_supabase_public_env' }, 500);
  }

  const bearer = getBearer(req);
  if (!bearer) {
    return json({ error: 'unauthorized', detail: 'missing_bearer' }, 401);
  }

  // Client using bearer auth (no service-role key required)
  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  const { data: u, error: uErr } = await client.auth.getUser(bearer);
  const user = u?.user;

  if (uErr || !user?.id) {
    return json({ error: 'unauthorized', detail: debug ? uErr?.message : null }, 401);
  }

  // Check invite credits
  const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data: fp } = await adminClient.from('user_fingerprint').select('invite_credits').eq('id', user.id).maybeSingle()
  const credits = fp?.invite_credits ?? 0
  if (credits <= 0) {
    return json({ error: 'no_invite_credits', detail: 'You have no invite credits remaining.' }, 403)
  }

  // Create token server-side
  const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars

  // Default expires: 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inviteRow, error: insErr } = await adminClient
    .from('invites')
    .insert({
      token,
      status: 'pending',
      inviter_user_id: user.id,
      channel: 'link',
      expires_at: expiresAt,
    })
    .select('id, token, status, expires_at')
    .single();

  if (insErr) {
    return json({ error: 'invite_insert_failed', detail: insErr.message, code: insErr.code }, 500);
  }
  if (!inviteRow) {
    return json({ error: 'invite_insert_no_row', detail: 'insert succeeded but no row returned' }, 500);
  }

  const siteUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || '').trim() ||
    req.headers.get('origin') ||
    'http://localhost:3000';

  const invite_url = `${siteUrl.replace(/\/+$/, '')}/invite/${inviteRow.token}`;

  // Deduct invite credit
  await adminClient.from('user_fingerprint').update({ invite_credits: credits - 1 }).eq('id', user.id);

  // Best-effort behavior log
  try {
    const dedup_key = `invite_create:${user.id}:${inviteRow.token}`;
    await client.from('behavior_events').insert({
      dedup_key,
      event_type: 'invite_created',
      source: 'api',
      created_at: new Date().toISOString(),
      user_id: user.id,
      invite_id: inviteRow.id,
      metadata: { channel: 'link', expires_at: inviteRow.expires_at },
    });
  } catch {
    // ignore
  }

  return json({ ok: true, invite_id: inviteRow.id, token: inviteRow.token, invite_url }, 200);
}

export async function GET() {
  return json({ error: 'method_not_allowed' }, 405);
}
