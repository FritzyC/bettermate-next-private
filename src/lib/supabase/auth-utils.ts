import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function verifySupabaseToken(token: string) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
