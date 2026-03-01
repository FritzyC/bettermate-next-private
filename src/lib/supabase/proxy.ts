import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './server';

export { registerNewUser } from './server';

export async function updateSession(request: NextRequest) {
  // For now, just pass through the request
  // You can add session refresh logic here later
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}
