cd "/Users/fritzgeraldcharpentier/Projects/bettermate-next/bettermate"
cat > "src/lib/bm/track.ts" <<'EOF'
import type { SupabaseClient } from "@supabase/supabase-js";

export type BMEventType =
  | "auth_send_otp"
  | "auth_verify_otp"
  | "invite_created"
  | "invite_opened"
  | "invite_accepted"
  | "match_created";

export async function trackEvent(
  supabase: SupabaseClient,
  event_type: BMEventType,
  input?: {
    source?: string;
    invite_id?: string | null;
    match_id?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user) return;

  await supabase.from("behavior_events").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    event_type,
    source: input?.source ?? "web",
    invite_id: input?.invite_id ?? null,
    match_id: input?.match_id ?? null,
    metadata: input?.metadata ?? {},
  });
}
EOF
