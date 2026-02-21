export const BM_LIB_VERSION = "bm-index-v5-2026-02-17";

export type BMEvent = {
  event_type: string;
  source: string;
  user_id?: string | null;
  user_email?: string | null;
  match_id?: string | null;
  invite_id?: string | null;
  date_plan_id?: string | null;
  message_id?: string | null;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
  dedup_key?: string;
};

type QueuedEvent = Required<Pick<BMEvent, "event_type" | "source" | "occurred_at" | "dedup_key">> &
  Omit<BMEvent, "event_type" | "source" | "occurred_at" | "dedup_key"> & {
    _queued_at: number;
  };

const STORAGE_KEY = "bm_event_queue_v5";
const MAX_QUEUE_SIZE = 200;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readQueue(): QueuedEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedEvent[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    const trimmed = events.slice(Math.floor(events.length * 0.2));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

function mkId(): string {
  // browser + modern node
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function bmNormalizeEvent(raw: Partial<BMEvent>): QueuedEvent {
  const nowIso = new Date().toISOString();
  const event_type = String(raw.event_type ?? "unknown").trim() || "unknown";
  const source = String(raw.source ?? "unknown").trim() || "unknown";

  return {
    event_type,
    source,
    user_id: raw.user_id ?? undefined,
    user_email: raw.user_email ?? undefined,
    match_id: raw.match_id ?? undefined,
    invite_id: raw.invite_id ?? undefined,
    date_plan_id: raw.date_plan_id ?? undefined,
    message_id: raw.message_id ?? undefined,
    metadata: raw.metadata ?? {},
    occurred_at: raw.occurred_at ?? nowIso,
    dedup_key: raw.dedup_key ?? `${source}-${event_type}-${mkId()}`,
    _queued_at: Date.now(),
  };
}

export function bmTrack(event: Partial<BMEvent>): void {
  if (!isBrowser()) return;

  const normalized = bmNormalizeEvent(event);
  const queue = readQueue();

  if (normalized.dedup_key && queue.some((e) => e.dedup_key === normalized.dedup_key)) return;

  const updated = [...queue, normalized].slice(-MAX_QUEUE_SIZE);
  writeQueue(updated);
}

export function bmQueueSize(): number {
  return readQueue().length;
}

export function bmPeekRaw(): QueuedEvent | null {
  const q = readQueue();
  return q.length ? q[0] : null;
}

export function bmPeekNormalized(): QueuedEvent | null {
  const raw = bmPeekRaw();
  return raw ? bmNormalizeEvent(raw) : null;
}

export function bmClearQueue(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}

export type BMFlushResult = { flushed: number; kept: number; lastError: string | null };

export async function bmFlushQueues(
  supabaseClient?: import("@supabase/supabase-js").SupabaseClient
): Promise<BMFlushResult> {
  const q = readQueue();
  if (q.length === 0) return { flushed: 0, kept: 0, lastError: null };

  // strip internal fields before insert
  const rows = q.map(({ _queued_at, ...rest }) => rest);

  let client = supabaseClient;
  if (!client) {
    try {
      const mod = await import("@/lib/supabaseClient");
      client = mod.getSupabase?.() ?? undefined;
    } catch (e) {
      return { flushed: 0, kept: q.length, lastError: `no_supabase_client: ${String(e)}` };
    }
  }

  if (!client) return { flushed: 0, kept: q.length, lastError: "no_supabase_client" };

  // Upsert by dedup_key to make retries safe
  const { error } = await client
    .from("behavior_events")
    .upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: true });

  if (error) {
    return { flushed: 0, kept: q.length, lastError: error.message };
  }

  // success: clear queue
  bmClearQueue();
  return { flushed: q.length, kept: 0, lastError: null };
}

export async function bmTrackAndFlush(
  event: Partial<BMEvent>,
  supabaseClient?: import("@supabase/supabase-js").SupabaseClient
): Promise<BMFlushResult> {
  bmTrack(event);
  return bmFlushQueues(supabaseClient);
}
