import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 7) ?? 'missing',
    hasGoogleKey: !!process.env.GOOGLE_PLACES_API_KEY,
  })
}
