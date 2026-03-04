import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    spotify_client_id_set: !!process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
    spotify_client_id_length: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID?.length || 0,
    spotify_secret_set: !!process.env.SPOTIFY_CLIENT_SECRET,
  });
}
