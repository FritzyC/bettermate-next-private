import type { SupabaseClient } from "@supabase/supabase-js";

export type BehaviorEventInsert = {
  dedup_key: string;
  event_type: string;
  source: string;
  created_at: string;
  user_id?: string;
  invite_id?: string;
  match_id?: string;
  metadata?: Record<string, any>;
};

const QUEUE_KEY = "bm_behavior_queue_v1";

function readQueue(): BehaviorEventInsert[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(items: BehaviorEventInsert[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-200)));
  } catch {}
}

export function enqueueEvent(evt: BehaviorEventInsert) {
  const q = readQueue();
  q.push(evt);
  writeQueue(q);
}

export async function flushQueue(supabase: SupabaseClient) {
  if (typeof window === "undefined") return;
  const q = readQueue();
  if (!q.length) return;
  const chunk = q.slice(0, 25);
  const rest = q.slice(25);
  const { error } = await supabase.from("behavior_events").insert(chunk);
  if (error) return;
  writeQueue(rest);
  if (rest.length) void flushQueue(supabase);
}

export async function safeLogEvent(
  supabase: SupabaseClient,
  evt: Omit<BehaviorEventInsert, "created_at" | "dedup_key"> & { dedup_key?: string }
) {
  try {
    const created_at = new Date().toISOString();
    const dedup_key = evt.dedup_key ?? `${evt.event_type}:${evt.user_id ?? "anon"}:${created_at.slice(0, 16)}`;
    const payload: BehaviorEventInsert = { dedup_key, created_at, ...evt } as BehaviorEventInsert;
    const { error } = await supabase.from("behavior_events").insert(payload);
    if (error) enqueueEvent(payload);
  } catch {
    return;
  }
}
