import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/supabase/auth-utils';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST /api/bonds - Create commitment bond
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

    const user = await verifySupabaseToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const body = await req.json();
    const { match_id } = body;

    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    // Get match
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

    // Verify user is part of match
    const isUser1 = match.user_id_1 === userId;
    const isUser2 = match.user_id_2 === userId;

    if (!isUser1 && !isUser2) {
      return NextResponse.json(
        { error: 'Unauthorized - not part of this match' },
        { status: 403 }
      );
    }

    // Check if bond already exists for this user
    const { data: existingBond } = await supabaseAdmin
      .from('bettermate_bonds')
      .select('*')
      .eq('match_id', match_id)
      .eq('user_id', userId);

    if (existingBond && existingBond.length > 0) {
      return NextResponse.json(
        { error: 'Bond already created for this user', bond: existingBond[0] },
        { status: 409 }
      );
    }

    const bondAmount = 15.00;

    // Create bond
    const { data: newBond, error: bondError } = await supabaseAdmin
      .from('bettermate_bonds')
      .insert({
        match_id,
        user_id: userId,
        amount: bondAmount,
        status: 'locked',
      })
      .select()
      .single();

    if (bondError || !newBond) {
      console.error('Bond create error:', bondError);
      return NextResponse.json(
        { error: 'Failed to create bond' },
        { status: 500 }
      );
    }

    // Update user's locked bonds
    const { data: userProfile } = await supabaseAdmin
      .from('bettermate_users')
      .select('total_bonds_locked')
      .eq('id', userId)
      .single();

    await supabaseAdmin
      .from('bettermate_users')
      .update({
        total_bonds_locked: (userProfile?.total_bonds_locked || 0) + bondAmount,
      })
      .eq('id', userId);

    // Check if both users have committed bonds
    const { data: allBonds } = await supabaseAdmin
      .from('bettermate_bonds')
      .select('*')
      .eq('match_id', match_id)
      .eq('status', 'locked');

    const bothCommitted = allBonds && allBonds.length === 2;

    console.log(`✅ Bond created: ${userId} ($${bondAmount}) for match ${match_id}`);
    if (bothCommitted) {
      console.log(`✅ BOTH USERS COMMITTED - $30 total at stake!`);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Commitment bond locked - $15 held in escrow',
        data: {
          bond_id: newBond.id,
          match_id,
          amount: bondAmount,
          status: 'locked',
          both_committed: bothCommitted,
          total_at_stake: bothCommitted ? 30.00 : 15.00,
          settlement_rules: {
            both_show: 'Each user gets full $15 back to wallet',
            one_ghosts: 'Showed up gets $10, BetterMate gets $5 from ghost',
            both_ghost: 'Each gets $5 back, BetterMate gets $10, each loses $10 penalty',
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create bond error:', error);
    return NextResponse.json(
      { error: `Failed to create bond: ${error}` },
      { status: 500 }
    );
  }
}

// GET /api/bonds?match_id=xxx
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

    const user = await verifySupabaseToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const match_id = searchParams.get('match_id');

    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    // Verify user is part of match
    const { data: match } = await supabaseAdmin
      .from('bettermate_matches')
      .select('user_id_1, user_id_2')
      .eq('id', match_id)
      .single();

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    if (match.user_id_1 !== userId && match.user_id_2 !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get bonds
    const { data: bonds } = await supabaseAdmin
      .from('bettermate_bonds')
      .select('*')
      .eq('match_id', match_id);

    const yourBond = bonds?.find((b: any) => b.user_id === userId);
    const otherBond = bonds?.find((b: any) => b.user_id !== userId);

    return NextResponse.json(
      {
        success: true,
        data: {
          your_bond: yourBond || null,
          other_user_committed: !!otherBond,
          both_committed: bonds && bonds.length === 2,
          total_at_stake: (bonds || []).reduce((sum: number, b: any) => sum + b.amount, 0),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Fetch bonds error:', error);
    return NextResponse.json(
      { error: `Failed to fetch bonds: ${error}` },
      { status: 500 }
    );
  }
}
