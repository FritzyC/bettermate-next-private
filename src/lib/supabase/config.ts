export function bmDebugEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_BM_DEBUG ?? "") === "1";
}

export function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
}

export function getSupabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function safeKeyPrefix(key: string): string {
  return key ? key.slice(0, 8) : "";
}
