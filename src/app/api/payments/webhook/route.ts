import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'


function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const { user_id, purchase_type, match_id, days } = pi.metadata
    const admin = adminClient()
    const { credits_amount, bundle_id } = pi.metadata

    if (purchase_type === 'match_reactivation' && match_id) {
      const dedup_key = 'reactivate_' + pi.id
      const { data: existing } = await admin.from('credit_ledger').select('id').eq('dedup_key', dedup_key).maybeSingle()
      if (!existing) {
        await admin.from('matches').update({
          on_hold_at: null,
          meet_deadline: new Date(Date.now() + 168 * 3600000).toISOString(),
          status: 'active',
        }).eq('id', match_id)
        try { await admin.from('behavior_events').insert({ event_type: 'match_reactivated', user_id, payload: { match_id, pi_id: pi.id }, created_at: new Date().toISOString() }) } catch (_) {}
        await admin.from('credit_ledger').insert({ user_id, amount: 0, type: 'match_reactivation', dedup_key, metadata: { match_id } })
      }
      return NextResponse.json({ ok: true })
    }

    if (purchase_type === 'extended_chat' && match_id) {
      const dedup_key = 'extchat_' + pi.id
      const { data: existing } = await admin.from('credit_ledger').select('id').eq('dedup_key', dedup_key).maybeSingle()
      if (!existing) {
        const daysNum = parseInt(days ?? '1')
        const { data: match } = await admin.from('matches').select('extended_chat_expires_at').eq('id', match_id).single()
        const base = match?.extended_chat_expires_at && new Date(match.extended_chat_expires_at) > new Date()
          ? new Date(match.extended_chat_expires_at)
          : new Date()
        const newExpiry = new Date(base.getTime() + daysNum * 24 * 3600000).toISOString()
        await admin.from('matches').update({ extended_chat_expires_at: newExpiry, on_hold_at: null }).eq('id', match_id)
        try { await admin.from('behavior_events').insert({ event_type: 'extended_chat_purchased', user_id, payload: { match_id, days: daysNum, expires_at: newExpiry }, created_at: new Date().toISOString() }) } catch (_) {}
        await admin.from('credit_ledger').insert({ user_id, amount: 0, type: 'extended_chat', dedup_key, metadata: { match_id, days: daysNum } })
      }
      return NextResponse.json({ ok: true })
    }

    if (!user_id || !credits_amount) return NextResponse.json({ ok: true })

    const credits = parseInt(credits_amount)
    const dedup_key = 'stripe_pi_' + pi.id

    // Idempotency check
    const { data: existing } = await admin
      .from('credit_ledger')
      .select('id')
      .eq('dedup_key', dedup_key)
      .single()

    if (existing) {
      console.log('Already credited, skipping:', dedup_key)
      return NextResponse.json({ ok: true })
    }

    // Credit wallet
    const { data: wallet } = await admin
      .from('user_credits')
      .select('balance')
      .eq('user_id', user_id)
      .single()

    const currentBalance = wallet?.balance || 0

    await admin.from('credit_ledger').insert({
      user_id,
      amount: credits,
      type: 'topup_credit',
      dedup_key,
    })

    if (wallet) {
      await admin.from('user_credits')
        .update({ balance: currentBalance + credits })
        .eq('user_id', user_id)
    } else {
      await admin.from('user_credits')
        .insert({ user_id, balance: credits, locked_balance: 0 })
    }

    console.log(`Credited ${credits} credits to ${user_id} via ${pi.id}`)
  }

  return NextResponse.json({ ok: true })
}
