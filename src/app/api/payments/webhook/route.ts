import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig || !webhookSecret) {
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { user_id, match_id, days_count } = paymentIntent.metadata;

      console.log(`✅ Payment succeeded: ${paymentIntent.id}`);

      await supabaseAdmin
        .from('bettermate_payments')
        .update({
          status: 'succeeded',
          completed_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      const { data: user } = await supabaseAdmin
        .from('bettermate_users')
        .select('wallet_balance')
        .eq('id', user_id)
        .single();

      const amount = (paymentIntent.amount / 100).toFixed(2);
      await supabaseAdmin
        .from('bettermate_users')
        .update({
          wallet_balance: (user?.wallet_balance || 0) + parseFloat(amount),
        })
        .eq('id', user_id);

      const { data: matchData } = await supabaseAdmin
        .from('bettermate_matches')
        .select('distance_km')
        .eq('id', match_id)
        .single();

      await supabaseAdmin.from('bettermate_long_distance_subscriptions').insert({
        user_id,
        match_id,
        stripe_subscription_id: paymentIntent.id,
        daily_rate: 0.99,
        distance_km: matchData?.distance_km || 0,
        status: 'active',
        next_billing_date: new Date(Date.now() + parseInt(days_count) * 24 * 60 * 60 * 1000).toISOString(),
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`❌ Payment failed: ${paymentIntent.id}`);

      await supabaseAdmin
        .from('bettermate_payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      return NextResponse.json({ received: true }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: `Webhook error: ${error}` },
      { status: 500 }
    );
  }
}
