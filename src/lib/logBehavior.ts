/**
 * logBehavior – unified, best-effort behavior event logger.
 *
 * Browser: queues via bmTrack (dedup_key handled by bm.ts).
 * Server:  directly upserts into behavior_events via Supabase.
 *
 * Never throws – all errors are swallowed so callers stay unaffected.
 */

import type { BMEventData } from "@/lib/types";

function mkId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Log a behavior event from either browser or server context.
 *
 * @param eventType  Canonical event type string (see EVENT_TYPES in types.ts)
 * @param eventData  Optional payload – merged into the event row
 */
export async function logBehavior(
  eventType: string,
  eventData: BMEventData = {}
): Promise<void> {
  try {
    const source = eventData.source ?? (isBrowser() ? "browser" : "server");
    const dedupKey =
      eventData.dedup_key ??
      `${source}-${eventType}-${eventData.user_id ?? "anon"}-${mkId()}`;

    if (isBrowser()) {
      // Lazy-import to avoid pulling browser-only code into server bundles
      const { bmTrack } = await import("@/lib/bm");
      bmTrack({
        event_type: eventType,
        source,
        user_id: eventData.user_id ?? undefined,
        user_email: eventData.user_email ?? undefined,
        match_id: eventData.match_id ?? undefined,
        invite_id: eventData.invite_id ?? undefined,
        date_plan_id: eventData.date_plan_id ?? undefined,
        message_id: eventData.message_id ?? undefined,
        metadata: eventData.metadata,
        occurred_at: eventData.occurred_at,
        dedup_key: dedupKey,
      });
      return;
    }

    // Server path: direct upsert
    const { getServerSupabaseClient } = await import("@/lib/supabase/server");
    const client = await getServerSupabaseClient();
    if (!client) return;

    await client.from("behavior_events").upsert(
      [
        {
          dedup_key: dedupKey,
          event_type: eventType,
          source,
          created_at: eventData.occurred_at ?? new Date().toISOString(),
          user_id: eventData.user_id ?? null,
          invite_id: eventData.invite_id ?? null,
          match_id: eventData.match_id ?? null,
          date_plan_id: eventData.date_plan_id ?? null,
          message_id: eventData.message_id ?? null,
          event_data: eventData.metadata ?? {},
        },
      ],
      { onConflict: "dedup_key", ignoreDuplicates: true }
    );
  } catch {
    // best-effort – never propagate
  }
}
