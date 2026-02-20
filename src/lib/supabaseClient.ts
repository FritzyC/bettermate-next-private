import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __BM_SUPABASE_BROWSER_CLIENT__: SupabaseClient | undefined;
}

function safeTrim(v: string | undefined | null): string {
  return (v ?? "").trim();
}

function getEnv() {
  const url = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return { url, anonKey };
}

export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  const { url, anonKey } = getEnv();
  if (!url || !anonKey) return null;

  if (!globalThis.__BM_SUPABASE_BROWSER_CLIENT__) {
    globalThis.__BM_SUPABASE_BROWSER_CLIENT__ = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });

    const debug = safeTrim(process.env.NEXT_PUBLIC_BM_DEBUG);
    if (debug === "1") {
      (globalThis as any).__BM_SUPABASE__ = globalThis.__BM_SUPABASE_BROWSER_CLIENT__;
    }
  }

  return globalThis.__BM_SUPABASE_BROWSER_CLIENT__!;
}

/**
 * Compatibility export expected by app code:
 * import { getSupabase } from "@/lib/supabaseClient"
 */
export function getSupabase(): SupabaseClient | null {
  return getBrowserSupabaseClient();
}

/** Legacy alias */
export function getSupabaseClient(): SupabaseClient | null {
  return getBrowserSupabaseClient();
}

/** Legacy singleton export */
export const supabase: SupabaseClient | null =
  typeof window === "undefined" ? null : getBrowserSupabaseClient();
