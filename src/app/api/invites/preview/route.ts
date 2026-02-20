import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json({ error: 'missing_supabase_public_env' }, { status: 500 });
  }

  const requestUrl = new URL(req.url);
  const token = requestUrl.searchParams.get('token');

  if (!token || token.trim().length < 8) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token.trim() });

  if (error) {
    console.error('[api/invites/preview] rpc error:', error);
    return NextResponse.json({ error: 'rpc_error', detail: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? { error: 'not_found' }, { status: 200 });
}
