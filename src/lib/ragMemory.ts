/**
 * ragMemory – upsert derived user memory/trait items for RAG context.
 *
 * Derives user traits from behavior patterns and persists them to
 * user_memory_items so they can be retrieved during AI-assisted flows.
 *
 * Best-effort: never throws.
 */

import type { MemoryItem } from "@/lib/types";

/**
 * Upsert a memory item for a user (keyed on user_id + memory_type).
 *
 * @param userId         The user's UUID
 * @param memoryType     Short label for the trait, e.g. "prefers_link_invite"
 * @param content        Human-readable description of the trait/memory
 * @param confidence     0.0 – 1.0 confidence score
 * @param sourceEventIds UUIDs of behavior_events that produced this memory
 */
export async function upsertMemoryItem(
  userId: string,
  memoryType: string,
  content: string,
  confidence: number,
  sourceEventIds: string[] = []
): Promise<MemoryItem | null> {
  try {
    const { getServerSupabaseClient } = await import("@/lib/supabase/server");
    const client = await getServerSupabaseClient();
    if (!client) return null;

    const now = new Date().toISOString();

    const { data, error } = await client
      .from("user_memory_items")
      .upsert(
        [
          {
            user_id: userId,
            memory_type: memoryType,
            content,
            confidence: Math.min(1, Math.max(0, confidence)),
            source_events: sourceEventIds,
            updated_at: now,
          },
        ],
        { onConflict: "user_id,memory_type" }
      )
      .select()
      .single();

    if (error) return null;
    return data as MemoryItem;
  } catch {
    return null;
  }
}

/**
 * Derive and upsert memory items from recent invite behavior.
 *
 * Looks at the user's invite creation history and writes a simple
 * preference trait so downstream RAG prompts can reference it.
 *
 * @param userId The user's UUID
 */
export async function deriveInviteMemory(userId: string): Promise<void> {
  try {
    const { getServerSupabaseClient } = await import("@/lib/supabase/server");
    const client = await getServerSupabaseClient();
    if (!client) return;

    const { data: events, error } = await client
      .from("behavior_events")
      .select("id, event_type, event_data, created_at")
      .eq("user_id", userId)
      .in("event_type", ["invite_created", "invite.accepted"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !events || events.length === 0) return;

    const created = events.filter((e: { event_type: string }) => e.event_type === "invite_created");
    const accepted = events.filter((e: { event_type: string }) => e.event_type === "invite.accepted");

    if (created.length > 0) {
      await upsertMemoryItem(
        userId,
        "invite_usage",
        `User has created ${created.length} invite link(s); ${accepted.length} accepted.`,
        Math.min(1, 0.5 + created.length * 0.1),
        events.map((e: { id: string }) => e.id)
      );
    }
  } catch {
    // best-effort
  }
}
