import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";

type Json = Record<string, any>;

type TrackPayload = {
  event_type: string;
  source: string;
  metadata?: Json | null;
};

type RememberPayload = {
  kind: string;
  key: string;
  value: Json;
  confidence?: number | null;
  metadata?: Json | null;
};

const BM_EVENT_QUEUE_KEY = "bm_event_queue_v1";
const BM_MEMORY_QUEUE_KEY = "bm_memory_queue_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (!isBrowser()) return;
    localStorage.setItem(key, value);
  } catch {}
}

function safeGetItem(key: string): string | null {
  try {
    if (!isBrowser()) return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (!isBrowser()) return;
    localStorage.removeItem(key);
  } catch {}
}

function getOnline(): boolean {
  if (!isBrowser()) return true;
  return navigator.onLine !== false;
}

function enqueueEvent(payload: TrackPayload): void {
  if (!isBrowser()) return;
  const current = safeParseJson<TrackPayload[]>(safeGetItem(BM_EVENT_QUEUE_KEY), []);
  current.push(payload);
  safeSetItem(BM_EVENT_QUEUE_KEY, JSON.stringify(current));
}

function enqueueMemory(payload: RememberPayload): void {
  if (!isBrowser()) return;
  const current = safeParseJson<RememberPayload[]>(safeGetItem(BM_MEMORY_QUEUE_KEY), []);
  current.push(payload);
  safeSetItem(BM_MEMORY_QUEUE_KEY, JSON.stringify(current));
}

async function tryGetUserId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function safeNumber(n: any, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function createPageUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim();

  const url = new URL(`${base}${normalizedPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function bmTrack(
  event_type: string,
  source: string,
  metadata?: Json
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const payload: TrackPayload = { event_type, source, metadata: metadata ?? null };

    if (!supabase) {
      enqueueEvent(payload);
      return { ok: false, queued: true, error: "supabase_null" };
    }

    if (!getOnline()) {
      enqueueEvent(payload);
      return { ok: false, queued: true, error: "offline" };
    }

    const user_id = await tryGetUserId(supabase);

    const { error } = await supabase.from("behavior_events").insert({
      event_type,
      source,
      metadata: metadata ?? null,
      user_id,
      created_at: nowIso(),
    });

    if (error) {
      enqueueEvent(payload);
      return { ok: false, queued: true, error: error.message };
    }

    void bmFlushQueues();
    return { ok: true };
  } catch (e: any) {
    try {
      enqueueEvent({ event_type, source, metadata: metadata ?? null });
    } catch {}
    return { ok: false, queued: true, error: e?.message ? String(e.message) : String(e) };
  }
}

export async function bmRemember(
  kind: string,
  key: string,
  value: Json,
  opts?: { confidence?: number; metadata?: Json }
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const payload: RememberPayload = {
      kind,
      key,
      value,
      confidence: opts?.confidence ?? null,
      metadata: opts?.metadata ?? null,
    };

    if (!supabase) {
      enqueueMemory(payload);
      return { ok: false, queued: true, error: "supabase_null" };
    }

    if (!getOnline()) {
      enqueueMemory(payload);
      return { ok: false, queued: true, error: "offline" };
    }

    const user_id = await tryGetUserId(supabase);
    if (!user_id) {
      enqueueMemory(payload);
      return { ok: false, queued: true, error: "no_user" };
    }

    const confidence = safeNumber(opts?.confidence, 0.6);

    const { error } = await supabase
      .from("user_memory")
      .upsert(
        {
          user_id,
          kind,
          key,
          value,
          confidence,
          metadata: opts?.metadata ?? null,
          updated_at: nowIso(),
        },
        { onConflict: "user_id,kind,key" }
      );

    if (error) {
      enqueueMemory(payload);
      return { ok: false, queued: true, error: error.message };
    }

    void bmFlushQueues();
    return { ok: true };
  } catch (e: any) {
    try {
      enqueueMemory({
        kind,
        key,
        value,
        confidence: opts?.confidence ?? null,
        metadata: opts?.metadata ?? null,
      });
    } catch {}
    return { ok: false, queued: true, error: e?.message ? String(e.message) : String(e) };
  }
}

export async function bmFlushQueues(): Promise<void> {
  try {
    if (!isBrowser()) return;
    if (!getOnline()) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const eventQueue = safeParseJson<TrackPayload[]>(safeGetItem(BM_EVENT_QUEUE_KEY), []);
    if (eventQueue.length > 0) {
      const user_id = await tryGetUserId(supabase);
      const rows = eventQueue.map((p) => ({
        event_type: p.event_type,
        source: p.source,
        metadata: p.metadata ?? null,
        user_id,
        created_at: nowIso(),
      }));

      const { error } = await supabase.from("behavior_events").insert(rows);
      if (!error) safeRemoveItem(BM_EVENT_QUEUE_KEY);
    }

    const memoryQueue = safeParseJson<RememberPayload[]>(safeGetItem(BM_MEMORY_QUEUE_KEY), []);
    if (memoryQueue.length > 0) {
      const user_id = await tryGetUserId(supabase);
      if (!user_id) return;

      for (const m of memoryQueue) {
        const { error } = await supabase
          .from("user_memory")
          .upsert(
            {
              user_id,
              kind: m.kind,
              key: m.key,
              value: m.value,
              confidence: safeNumber(m.confidence, 0.6),
              metadata: m.metadata ?? null,
              updated_at: nowIso(),
            },
            { onConflict: "user_id,kind,key" }
          );
        if (error) return; // keep queue for later
      }

      safeRemoveItem(BM_MEMORY_QUEUE_KEY);
    }
  } catch {}
}

export async function callRpcAcceptInvite(token: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: "supabase_null" };

    const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message ? String(e.message) : String(e) };
  }
}
