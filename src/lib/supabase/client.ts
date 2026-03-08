import { getSupabase } from "@/lib/supabaseClient";

let _client: ReturnType<typeof getSupabase> | null = null;

function getClient() {
  if (!_client) {
    _client = getSupabase();
  }
  if (!_client) {
    throw new Error("Supabase client could not be initialized.");
  }
  return _client;
}

export const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabase>>, {
  get(_target, prop) {
    return getClient()[prop as keyof NonNullable<ReturnType<typeof getSupabase>>];
  },
});
