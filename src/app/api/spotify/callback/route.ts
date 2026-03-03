import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || '';
  const [userId] = state.split('|');
  if (!code || !userId) return NextResponse.redirect(new URL('/matches?spotify=error', req.url));

  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = new URL(req.url).origin + '/api/spotify/callback';

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return NextResponse.redirect(new URL('/matches?spotify=error', req.url));

  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: 'Bearer ' + tokens.access_token },
  });
  const profile = await profileRes.json();

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await supabase.from('user_integrations').upsert({
    user_id: userId,
    provider: 'spotify',
    provider_user_id: profile.id,
    display_name: profile.display_name,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  return NextResponse.redirect(new URL('/matches?spotify=connected', req.url));
}
