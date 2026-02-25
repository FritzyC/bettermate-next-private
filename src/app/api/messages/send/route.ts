/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  const { data: u, error: uErr } = await client.auth.getUser(bearer);
  const user = u?.user;

  if (uErr || !user?.id) {
    return json({ error: 'unauthorized', detail: debug ? uErr?.message : null }, 401);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request', detail: 'invalid_json' }, 400);
  }

  const matchId: string = body?.match_id;
  const messageBody: string = body?.body;

  if (!matchId || typeof matchId !== 'string') {
    return json({ error: 'bad_request', detail: 'missing_match_id' }, 400);
  }
  if (!messageBody || typeof messageBody !== 'string' || !messageBody.trim()) {
    return json({ error: 'bad_request', detail: 'missing_body' }, 400);
  }

  // Validate user is a participant in the match
  const { data: matchRow, error: matchErr } = await (client as any)
    .from('matches')
    .select('id,user_a_id,user_b_id,status')
    .eq('id', matchId)
    .maybeSingle();

  if (matchErr || !matchRow) {
    return json({ error: 'match_not_found', detail: debug ? matchErr?.message : null }, 404);
  }

  const userId = user.id;
  if (matchRow.user_a_id !== userId && matchRow.user_b_id !== userId) {
    return json({ error: 'forbidden', detail: 'not_a_participant' }, 403);
  }

  const trimmedBody = messageBody.trim();
  const hasLinks = /https?:\/\//.test(trimmedBody);

  // Insert message
  const { data: inserted, error: insertErr } = await (client as any)
    .from('messages')
    .insert({
      match_id: matchId,
      sender_user_id: userId,
      body: trimmedBody,
      metadata: { message_length: trimmedBody.length, has_links: hasLinks },
    })
    .select('id,match_id,sender_user_id,body,created_at,metadata')
    .single();

  if (insertErr) {
    return json({ error: 'insert_failed', detail: debug ? insertErr.message : null }, 500);
  }

  const msgId = inserted?.id ?? 'unknown';

  // Best-effort behavior log + RAG upsert (never fail message send)
  try {
    const dedup_key = `message_send:${userId}:${msgId}`;
    await (client as any).from('behavior_events').upsert(
      [
        {
          dedup_key,
          event_type: 'message_send',
          source: 'api/messages/send',
          created_at: new Date().toISOString(),
          user_id: userId,
          match_id: matchId,
          message_id: msgId,
          metadata: { message_length: trimmedBody.length, has_links: hasLinks },
        },
      ],
      { onConflict: 'dedup_key', ignoreDuplicates: true }
    );
  } catch {
    // ignore – best-effort
  }

  // Best-effort RAG memory upsert: engagement context
  try {
    const otherId =
      matchRow.user_a_id === userId ? matchRow.user_b_id : matchRow.user_a_id;
    await (client as any).from('user_memory_items').upsert(
      [
        {
          user_id: userId,
          key: `active_chat:${matchId}`,
          value: `actively chatting with ${otherId}`,
          confidence: 0.8,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'user_id,key', ignoreDuplicates: false }
    );
  } catch {
    // ignore – best-effort
  }

  return json({ ok: true, message: inserted });
}

export async function GET() {
  return json({ error: 'method_not_allowed' }, 405);
}
