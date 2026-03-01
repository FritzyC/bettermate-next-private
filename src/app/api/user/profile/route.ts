import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/supabase/auth-utils';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    // Fetch user from database
    const { data: userProfile, error } = await supabaseAdmin
      .from('bettermate_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          tier: userProfile.tier,
          trust_score: userProfile.trust_score,
          verified: userProfile.verified,
          created_at: userProfile.created_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: `Failed to fetch profile: ${error}` },
      { status: 500 }
    );
  }
}

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

    const user = await verifySupabaseToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Parse request body
    const body = await req.json();
    const { bio, interests, location, profile_picture_url } = body;

    // Validation
    if (bio && typeof bio !== 'string') {
      return NextResponse.json(
        { error: 'Bio must be a string' },
        { status: 400 }
      );
    }

    if (bio && bio.length > 500) {
      return NextResponse.json(
        { error: 'Bio must be 500 characters or less' },
        { status: 400 }
      );
    }

    if (interests && !Array.isArray(interests)) {
      return NextResponse.json(
        { error: 'Interests must be an array' },
        { status: 400 }
      );
    }

    if (interests && interests.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 interests allowed' },
        { status: 400 }
      );
    }

    if (location && typeof location !== 'string') {
      return NextResponse.json(
        { error: 'Location must be a string' },
        { status: 400 }
      );
    }

    if (location && location.length > 100) {
      return NextResponse.json(
        { error: 'Location must be 100 characters or less' },
        { status: 400 }
      );
    }

    if (profile_picture_url && typeof profile_picture_url !== 'string') {
      return NextResponse.json(
        { error: 'Profile picture URL must be a string' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (bio !== undefined) updateData.bio = bio;
    if (interests !== undefined) updateData.interests = interests;
    if (location !== undefined) updateData.location = location;
    if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url;

    // Update user in database
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('bettermate_users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError || !updatedUser) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    console.log(`✅ User profile updated: ${updatedUser.email}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          bio: updatedUser.bio,
          interests: updatedUser.interests,
          location: updatedUser.location,
          profile_picture_url: updatedUser.profile_picture_url,
          tier: updatedUser.tier,
          trust_score: updatedUser.trust_score,
          verified: updatedUser.verified,
          updated_at: updatedUser.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: `Failed to update profile: ${error}` },
      { status: 500 }
    );
  }
}
