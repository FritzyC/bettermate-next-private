/**
 * inviteUtils.ts – Server-safe invite helpers (no .tsx / no React types)
 *
 * generateInviteToken()      – secure 64-hex-char random string
 * validateInviteToken(token) – checks format (64 hex chars)
 * getInviteDetails(token)    – fetch invite row from Supabase DB
 */

// ─── Token generation ──────────────────────────────────────────────────────

/**
 * Generates a cryptographically-secure 64-character hex invite token.
 * Works in both Node.js (crypto module) and browser (Web Crypto).
 */
export function generateInviteToken(): string {
  // Node.js path (API routes / server components)
  if (typeof process !== "undefined" && process.versions?.node) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("crypto") as typeof import("crypto");
    return crypto.randomBytes(32).toString("hex");
  }

  // Browser / Edge path
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Token validation ──────────────────────────────────────────────────────

const TOKEN_RE = /^[0-9a-f]{64}$/i;

/**
 * Returns true when `token` matches the expected 64-hex-char format.
 */
export function validateInviteToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

// ─── DB lookup ─────────────────────────────────────────────────────────────

export type InviteDetails = {
  id: string;
  token: string;
  status: string;
  channel: string;
  expires_at: string;
  created_at: string;
  inviter_user_id: string;
  accepted_by?: string | null;
  accepted_at?: string | null;
  inviter_name?: string | null;
};

type SupabaseClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

/**
 * Fetches invite details from the `invites` table.
 * Returns null when the token is not found or an error occurs.
 *
 * @param client – a Supabase client instance (anon or service-role)
 * @param token  – 64-char hex invite token
 */
export async function getInviteDetails(
  client: SupabaseClientLike,
  token: string
): Promise<InviteDetails | null> {
  if (!validateInviteToken(token)) return null;

  const { data, error } = await client
    .from("invites")
    .select(
      "id, token, status, channel, expires_at, created_at, inviter_user_id, accepted_by, accepted_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  return data as InviteDetails;
}
