import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// Verify Supabase token
async function verifySupabaseToken(token: string) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authentication token' },
        { status: 401 }
      );
    }

    // Verify Supabase token
    const user = await verifySupabaseToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const body = await req.json();
    const { match_id, days_count } = body;

    if (!match_id || !days_count) {
      return NextResponse.json(
        { error: 'match_id and days_count are required' },
        { status: 400 }
      );
    }

    const { data: match } = await supabaseAdmin
      .from('bettermate_matches')
      .select('*')
      .eq('id', match_id)
      .single();

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    const LONG_DISTANCE_THRESHOLD = 50;
    if (match.distance_km < LONG_DISTANCE_THRESHOLD) {
      return NextResponse.json(
        { error: 'Long-distance fee only applies for matches >50km apart' },
        { status: 400 }
      );
    }

    const dailyRate = 0.99;
    const amount = Math.round(dailyRate * days_count * 100);
    const amountDollars = (amount / 100).toFixed(2);

    const { data: userProfile } = await supabaseAdmin
      .from('bettermate_users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 404 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        user_id: userId,
        match_id,
        days_count: days_count.toString(),
      },
      description: `BetterMate long-distance fee: ${days_count} days @ $${dailyRate}/day`,
    });

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('bettermate_payments')
      .insert({
        user_id: userId,
        match_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: parseFloat(amountDollars),
        currency: 'USD',
        status: 'pending',
        payment_type: 'long_distance_fee',
        days_count,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment record error:', paymentError);
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      );
    }

    console.log(`✅ Payment intent created: ${paymentIntent.id} ($${amountDollars} for ${days_count} days)`);

    return NextResponse.json(
      {
        success: true,
        message: 'Payment intent created',
        data: {
          payment_id: payment.id,
          client_secret: paymentIntent.client_secret,
          amount: parseFloat(amountDollars),
          days_count,
          daily_rate: dailyRate,
          total: parseFloat(amountDollars),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Payment intent error:', error);
    return NextResponse.json(
      { error: `Failed to create payment intent: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authentication token' },
        { status: 401 }
      );
    }

    // Verify Supabase token
    const user = await verifySupabaseToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('bettermate_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: payments } = await query;

    const totalSpent = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const successfulPayments = payments?.filter((p) => p.status === 'succeeded') || [];

    return NextResponse.json(
      {
        success: true,
        data: {
          payments: payments || [],
          stats: {
            total_spent: totalSpent.toFixed(2),
            successful_payments: successfulPayments.length,
            pending_payments: (payments || []).filter((p) => p.status === 'pending').length,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Fetch payments error:', error);
    return NextResponse.json(
      { error: `Failed to fetch payments: ${error}` },
      { status: 500 }
    );
  }
}
