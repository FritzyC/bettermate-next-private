import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Verify a Supabase JWT token and return the user
 */
export async function verifySupabaseToken(token: string) {
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
