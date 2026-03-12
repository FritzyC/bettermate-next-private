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

  const { bundle_id } = await req.json()
  const bundle = BUNDLES[bundle_id]
  if (!bundle) return NextResponse.json({ error: 'Invalid bundle' }, { status: 400 })

  const paymentIntent = await stripe.paymentIntents.create({
    amount: bundle.cents,
    currency: 'usd',
    metadata: {
      user_id: user.id,
      bundle_id,
      credits_amount: String(bundle.credits),
      app_env: process.env.NODE_ENV || 'production',
    },
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, bundle })
}
