import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { registerNewUser } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { email, password, display_name } = await req.json();

    // Validation
    if (!email || !password || !display_name) {
      return NextResponse.json(
        { error: 'Email, password, and display_name are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user in database
    const newUser = await registerNewUser(email, passwordHash, display_name);

    // Log successful registration
    console.log(`✅ User registered: ${email} (${newUser.id})`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          display_name,
          tier: newUser.tier,
          trust_score: newUser.trust_score,
          verified: newUser.verified,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: `Failed to register user: ${error}` },
      { status: 500 }
    );
  }
}
