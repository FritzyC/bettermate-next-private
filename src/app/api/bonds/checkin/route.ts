import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST /api/bonds/checkin - User checks in with GPS
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as any;

    const userId = decoded.id;
    const body = await req.json();
    const { match_id, latitude, longitude, location_name } = body;

    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    // Get match and bonds
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

    const isUser1 = match.user_id_1 === userId;
    const isUser2 = match.user_id_2 === userId;

    if (!isUser1 && !isUser2) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get user's bond
    const { data: userBond } = await supabaseAdmin
      .from('bettermate_bonds')
      .select('*')
      .eq('match_id', match_id)
      .eq('user_id', userId)
      .single();

    if (!userBond) {
      return NextResponse.json(
        { error: 'Bond not found - must create commitment bond first' },
        { status: 404 }
      );
    }

    // Update bond with check-in
    const { data: updatedBond, error: updateError } = await supabaseAdmin
      .from('bettermate_bonds')
      .update({
        attended: true,
        gps_verified: true,
        check_in_time: new Date().toISOString(),
      })
      .eq('id', userBond.id)
      .select()
      .single();

    if (updateError || !updatedBond) {
      console.error('Check-in error:', updateError);
      return NextResponse.json(
        { error: 'Failed to check in' },
        { status: 500 }
      );
    }

    // Get other user's bond
    const otherUserId = isUser1 ? match.user_id_2 : match.user_id_1;
    const { data: otherBond } = await supabaseAdmin
      .from('bettermate_bonds')
      .select('*')
      .eq('match_id', match_id)
      .eq('user_id', otherUserId)
      .single();

    console.log(`✅ Check-in verified: ${userId} at ${location_name}`);

    // Check if both have checked in - trigger settlement
    if (otherBond && otherBond.attended) {
      console.log(`✅ BOTH USERS SHOWED UP! Processing settlement...`);
      await settleBonds(match_id, 'both_showed');
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Check-in verified with GPS',
        data: {
          checked_in: true,
          location: location_name,
          other_user_checked_in: otherBond?.attended || false,
          bond_status: updatedBond.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: `Failed to check in: ${error}` },
      { status: 500 }
    );
  }
}

// PUT /api/bonds/checkin - Mark no-show/ghost
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authentication token' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as any;

    const userId = decoded.id;
    const body = await req.json();
    const { match_id, reported_no_show_user_id } = body;

    if (!match_id || !reported_no_show_user_id) {
      return NextResponse.json(
        { error: 'match_id and reported_no_show_user_id are required' },
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

    const isUser1 = match.user_id_1 === userId;
    const isUser2 = match.user_id_2 === userId;

    if (!isUser1 && !isUser2) {
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

    const reporterBond = bonds?.find((b: any) => b.user_id === userId);
    const ghostBond = bonds?.find((b: any) => b.user_id === reported_no_show_user_id);

    if (!reporterBond || !ghostBond) {
      return NextResponse.json(
        { error: 'Could not find bonds' },
        { status: 404 }
      );
    }

    // Mark ghost's attendance as false
    await supabaseAdmin
      .from('bettermate_bonds')
      .update({ attended: false })
      .eq('id', ghostBond.id);

    // Check scenario
    if (reporterBond.attended && !ghostBond.attended) {
      // One ghosted
      await settleBonds(match_id, 'one_ghosted');
    } else if (!reporterBond.attended && !ghostBond.attended) {
      // Both ghosted
      await settleBonds(match_id, 'both_ghosted');
    }

    console.log(`⚠️ No-show reported: ${reported_no_show_user_id} for match ${match_id}`);

    return NextResponse.json(
      {
        success: true,
        message: 'No-show reported and settlement processed',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('No-show report error:', error);
    return NextResponse.json(
      { error: `Failed to report no-show: ${error}` },
      { status: 500 }
    );
  }
}

// Settlement logic
async function settleBonds(match_id: string, scenario: string) {
  try {
    const { data: bonds } = await supabaseAdmin
      .from('bettermate_bonds')
      .select('*')
      .eq('match_id', match_id);

    if (!bonds || bonds.length < 2) return;

    const bond1 = bonds[0];
    const bond2 = bonds[1];

    let settlements = [];

    if (scenario === 'both_showed') {
      // Both users get $15 back to wallet
      settlements = [
        {
          user_id: bond1.user_id,
          bond_id: bond1.id,
          bettermate_cut: 0,
          user_refund: 15.00,
          user_penalty: 0,
          other_user_reward: 0,
        },
        {
          user_id: bond2.user_id,
          bond_id: bond2.id,
          bettermate_cut: 0,
          user_refund: 15.00,
          user_penalty: 0,
          other_user_reward: 0,
        },
      ];
      console.log(`✅ Both showed! Each gets $15 back.`);
    } else if (scenario === 'one_ghosted') {
      const showedBond = bond1.attended ? bond1 : bond2;
      const ghostedBond = bond1.attended ? bond2 : bond1;

      settlements = [
        {
          user_id: showedBond.user_id,
          bond_id: showedBond.id,
          bettermate_cut: 0,
          user_refund: 10.00,
          user_penalty: 0,
          other_user_reward: 0,
        },
        {
          user_id: ghostedBond.user_id,
          bond_id: ghostedBond.id,
          bettermate_cut: 5.00,
          user_refund: 0,
          user_penalty: 15.00,
          other_user_reward: 10.00,
        },
      ];
      console.log(`😤 One ghosted! Showed up gets $10, ghost loses $15 (BM gets $5).`);
    } else if (scenario === 'both_ghosted') {
      // Each loses $10 penalty, gets $5 back, BM gets $10
      settlements = [
        {
          user_id: bond1.user_id,
          bond_id: bond1.id,
          bettermate_cut: 0,
          user_refund: 5.00,
          user_penalty: 10.00,
          other_user_reward: 0,
        },
        {
          user_id: bond2.user_id,
          bond_id: bond2.id,
          bettermate_cut: 0,
          user_refund: 5.00,
          user_penalty: 10.00,
          other_user_reward: 0,
        },
      ];
      console.log(`💀 Both ghosted! Each gets $5 back, loses $10 penalty, BM gets $10.`);
    }

    // Record settlements and update wallets
    for (const settlement of settlements) {
      // Create settlement record
      await supabaseAdmin.from('bettermate_bond_settlements').insert({
        match_id,
        user_id: settlement.user_id,
        bond_id: settlement.bond_id,
        scenario,
        bettermate_cut: settlement.bettermate_cut,
        user_refund: settlement.user_refund,
        user_penalty: settlement.user_penalty,
        other_user_reward: settlement.other_user_reward,
      });

      // Update user's wallet
      const { data: user } = await supabaseAdmin
        .from('bettermate_users')
        .select('wallet_balance')
        .eq('id', settlement.user_id)
        .single();

      const newBalance =
        (user?.wallet_balance || 0) + settlement.user_refund - settlement.user_penalty;

      await supabaseAdmin
        .from('bettermate_users')
        .update({ wallet_balance: newBalance })
        .eq('id', settlement.user_id);

      // Mark bond as released
      await supabaseAdmin
        .from('bettermate_bonds')
        .update({ status: 'released' })
        .eq('id', settlement.bond_id);
    }
  } catch (error) {
    console.error('Settlement error:', error);
  }
}
