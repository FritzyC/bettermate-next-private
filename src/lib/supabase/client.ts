import { getSupabase } from "@/lib/supabaseClient";

const client = getSupabase();

if (!client) {
  throw new Error("Supabase client could not be initialized.");
}

export const supabase = client;
