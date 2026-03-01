import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authentication token' },
        { status: 401 }
      );
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as any;

    const userId = decoded.id;

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const interests = searchParams.get('interests')?.split(',') || [];
    const location = searchParams.get('location') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Validation
    if (limit > 50) {
      return NextResponse.json(
        { error: 'Maximum limit is 50' },
        { status: 400 }
      );
    }

    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be greater than 0' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabaseAdmin
      .from('bettermate_users')
      .select('id, email, bio, interests, location, profile_picture_url, tier, trust_score, verified, created_at', { count: 'exact' })
      .neq('id', userId);

    // Filter by interests (user must have at least one matching interest)
    if (interests.length > 0 && interests[0] !== '') {
      query = query.overlaps('interests', interests);
    }

    // Filter by location (case-insensitive partial match)
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    // Sort by trust score and created date
    query = query
      .order('trust_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    console.log(`✅ User search: ${users?.length || 0} results found for user ${userId}`);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json(
      {
        success: true,
        data: {
          users: users || [],
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
    console.error('User search error:', error);
    return NextResponse.json(
      { error: `Failed to search users: ${error}` },
      { status: 500 }
    );
  }
}
