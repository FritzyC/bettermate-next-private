import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'



const BUNDLES: Record<string, { credits: number; cents: number; label: string }> = {
  credits_500:  { credits: 500,  cents: 499,  label: '500 credits' },
  credits_1000: { credits: 1000, cents: 999,  label: '1000 credits' },
  credits_2000: { credits: 2000, cents: 1999, label: '2000 credits' },
}

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { bundle_id, custom_cents } = body

  let amount: number
  let credits: number
  let bundleId: string

  if (custom_cents) {
    if (custom_cents < 500) return NextResponse.json({ error: 'Minimum $5.00' }, { status: 400 })
    amount = custom_cents
    credits = custom_cents
    bundleId = 'custom'
  } else {
    const bundle = BUNDLES[bundle_id]
    if (!bundle) return NextResponse.json({ error: 'Invalid bundle' }, { status: 400 })
    amount = bundle.cents
    credits = bundle.credits
    bundleId = bundle_id
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: {
      user_id: user.id,
      bundle_id: bundleId,
      credits_amount: String(credits),
      app_env: process.env.NODE_ENV || 'production',
    },
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, credits, amount })
}
