import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST /api/matches/messages - Send a message
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
    const { match_id, content } = body;

    // Validation
    if (!match_id || !content) {
      return NextResponse.json(
        { error: 'match_id and content are required' },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: 'Message must be 1000 characters or less' },
        { status: 400 }
      );
    }

    // Verify user is part of this match
    const { data: match } = await supabaseAdmin
      .from('bettermate_matches')
      .select('id, user_id_1, user_id_2, status, message_count, user_1_messages, user_2_messages, reveal_at')
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
        { error: 'Unauthorized - not part of this match' },
        { status: 403 }
      );
    }

    if (match.status === 'rejected' || match.status === 'expired') {
      return NextResponse.json(
        { error: 'Cannot message on closed matches' },
        { status: 400 }
      );
    }

    // Create message
    const { data: newMessage, error: messageError } = await supabaseAdmin
      .from('bettermate_messages')
      .insert({
        match_id,
        sender_id: userId,
        content,
      })
      .select()
      .single();

    if (messageError || !newMessage) {
      console.error('Message create error:', messageError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Update message counts
    const newUserMessages = isUser1 ? match.user_1_messages + 1 : match.user_2_messages + 1;
    const newTotalMessages = match.message_count + 1;

    const { error: updateError } = await supabaseAdmin
      .from('bettermate_matches')
      .update({
        message_count: newTotalMessages,
        user_1_messages: isUser1 ? newUserMessages : match.user_1_messages,
        user_2_messages: isUser2 ? newUserMessages : match.user_2_messages,
      })
      .eq('id', match_id);

    if (updateError) {
      console.error('Update match error:', updateError);
    }

    const messagesNeeded = Math.max(0, 6 - newTotalMessages);
    const canReveal = newTotalMessages >= 6;

    console.log(`✅ Message sent in match ${match_id}: ${newTotalMessages}/6 messages`);

    return NextResponse.json(
      {
        success: true,
        message: 'Message sent',
        data: {
          message_id: newMessage.id,
          total_messages: newTotalMessages,
          messages_needed: messagesNeeded,
          can_reveal: canReveal,
          reveal_at: match.reveal_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: `Failed to send message: ${error}` },
      { status: 500 }
    );
  }
}

// GET /api/matches/messages?match_id=xxx - Get messages for a match
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as any;

    const userId = decoded.id;
    const { searchParams } = new URL(req.url);
    const match_id = searchParams.get('match_id');

    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    // Verify user is part of this match
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

    // Get messages
    const { data: messages, error } = await supabaseAdmin
      .from('bettermate_messages')
      .select('*')
      .eq('match_id', match_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch messages error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          messages: messages || [],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Fetch messages error:', error);
    return NextResponse.json(
      { error: `Failed to fetch messages: ${error}` },
      { status: 500 }
    );
  }
}
