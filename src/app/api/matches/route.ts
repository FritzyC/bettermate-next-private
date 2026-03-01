import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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

// Calculate distance between two locations (simplified)
function calculateDistance(loc1: string, loc2: string): number {
  if (loc1 === loc2) return 0;
  return Math.random() * 100;
}

// Helper function to calculate compatibility score
async function calculateCompatibility(userId1: string, userId2: string) {
  const { data: user1 } = await supabaseAdmin
    .from('bettermate_users')
    .select('interests, location')
    .eq('id', userId1)
    .single();

  const { data: user2 } = await supabaseAdmin
    .from('bettermate_users')
    .select('interests, location')
    .eq('id', userId2)
    .single();

  if (!user1 || !user2) return 0;

  let score = 50;
  const interests1 = user1.interests || [];
  const interests2 = user2.interests || [];
  const commonInterests = interests1.filter((i: string) =>
    interests2.includes(i)
  );
  const interestScore = (commonInterests.length / Math.max(interests1.length, interests2.length, 1)) * 30;
  score += interestScore;

  if (user1.location === user2.location) {
    score += 20;
  }

  return Math.min(score, 100);
}

// GET /api/matches
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
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('bettermate_matches')
      .select('*', { count: 'exact' })
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: matches, error, count } = await query;

    if (error) {
      console.error('Matches fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      );
    }

    const now = new Date();
    const formattedMatches = await Promise.all(
      (matches || []).map(async (match: any) => {
        const otherUserId = match.user_id_1 === userId ? match.user_id_2 : match.user_id_1;

        const { data: otherUser } = await supabaseAdmin
          .from('bettermate_users')
          .select('id, email, bio, interests, location, profile_picture_url, trust_score')
          .eq('id', otherUserId)
          .single();

        let phase = 'expired';
        let revealed = false;
        let timeRemaining = null;

        const createdAt = new Date(match.created_at);
        const revealAt = new Date(match.reveal_at || new Date(createdAt.getTime() + 24 * 60 * 60 * 1000));
        const meetBy = new Date(match.meet_by || new Date(revealAt.getTime() + 72 * 60 * 60 * 1000));

        // REVEAL LOGIC: Show identity if 6+ messages OR 24 hours passed
        const hasEnoughMessages = match.message_count >= 6;
        const timeForReveal = now >= revealAt;
        const shouldReveal = hasEnoughMessages || timeForReveal;

        if (!shouldReveal && match.status === 'pending') {
          phase = 'blind_chat';
          timeRemaining = Math.ceil((revealAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        } else if (shouldReveal && match.status === 'pending') {
          phase = 'revealed';
          revealed = true;
          timeRemaining = Math.ceil((meetBy.getTime() - now.getTime()) / (1000 * 60 * 60));
        } else if (match.status === 'accepted') {
          phase = 'accepted';
          revealed = true;
        } else if (match.status === 'rejected') {
          phase = 'rejected';
        }

        return {
          id: match.id,
          status: match.status,
          phase,
          compatibility_score: revealed ? match.compatibility_score : null,
          distance_km: match.distance_km,
          message_count: match.message_count,
          messages_needed: Math.max(0, 6 - match.message_count),
          created_at: match.created_at,
          reveal_at: revealAt.toISOString(),
          meet_by: meetBy.toISOString(),
          time_remaining_hours: timeRemaining,
          other_user: revealed ? otherUser : {
            id: otherUser?.id,
            bio: otherUser?.bio,
            interests: otherUser?.interests,
            location: otherUser?.location,
          },
        };
      })
    );

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json(
      {
        success: true,
        data: {
          matches: formattedMatches,
          pagination: {
            page,
            limit,
            total: count || 0,
            total_pages: totalPages,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Matches error:', error);
    return NextResponse.json(
      { error: `Failed to fetch matches: ${error}` },
      { status: 500 }
    );
  }
}

// POST /api/matches
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
    const { target_user_id } = body;

    if (!target_user_id) {
      return NextResponse.json(
        { error: 'target_user_id is required' },
        { status: 400 }
      );
    }

    if (userId === target_user_id) {
      return NextResponse.json(
        { error: 'Cannot match with yourself' },
        { status: 400 }
      );
    }

    const { data: targetUser } = await supabaseAdmin
      .from('bettermate_users')
      .select('id, location')
      .eq('id', target_user_id)
      .single();

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    const { data: currentUser } = await supabaseAdmin
      .from('bettermate_users')
      .select('id, location')
      .eq('id', userId)
      .single();

    const minId = Math.min(userId, target_user_id);
    const maxId = Math.max(userId, target_user_id);

    const { data: existingMatch } = await supabaseAdmin
      .from('bettermate_matches')
      .select('id, status')
      .eq('user_id_1', minId)
      .eq('user_id_2', maxId);

    if (existingMatch && existingMatch.length > 0) {
      return NextResponse.json(
        { error: 'Match already exists', existing_status: existingMatch[0].status },
        { status: 409 }
      );
    }

    const compatibilityScore = await calculateCompatibility(userId, target_user_id);
    const distanceKm = calculateDistance(currentUser?.location || '', targetUser?.location || '');

    const now = new Date();
    const revealAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const meetBy = new Date(revealAt.getTime() + 72 * 60 * 60 * 1000);

    const { data: newMatch, error: createError } = await supabaseAdmin
      .from('bettermate_matches')
      .insert({
        user_id_1: minId,
        user_id_2: maxId,
        compatibility_score: compatibilityScore,
        distance_km: distanceKm,
        status: 'pending',
        reveal_at: revealAt.toISOString(),
        meet_by: meetBy.toISOString(),
        message_count: 0,
        user_1_messages: 0,
        user_2_messages: 0,
      })
      .select()
      .single();

    if (createError || !newMatch) {
      console.error('Create match error:', createError);
      return NextResponse.json(
        { error: 'Failed to create match' },
        { status: 500 }
      );
    }

    console.log(`✅ Blind match created: ${userId} <-> ${target_user_id} (${compatibilityScore.toFixed(1)}% | ${distanceKm.toFixed(1)}km)`);

    return NextResponse.json(
      {
        success: true,
        message: 'Blind match created - chat anonymously for 24 hours!',
        match: {
          id: newMatch.id,
          status: newMatch.status,
          phase: 'blind_chat',
          distance_km: newMatch.distance_km,
          reveal_at: revealAt.toISOString(),
          meet_by: meetBy.toISOString(),
          message_count: 0,
          messages_needed: 6,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create match error:', error);
    return NextResponse.json(
      { error: `Failed to create match: ${error}` },
      { status: 500 }
    );
  }
}
