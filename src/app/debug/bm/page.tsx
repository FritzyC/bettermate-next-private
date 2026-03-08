"use client";
export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import {
  BM_LIB_VERSION,
  bmQueueSize,
  bmFlushQueues,
  bmTrack,
  bmClearQueue,
  bmPeekRaw,
  bmPeekNormalized,
} from "@/lib/bm";

export default function BmDebugPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const [mounted, setMounted] = useState(false);

  const [queueSize, setQueueSize] = useState<number>(0);
  const [boot, setBoot] = useState<any>(null);
  const [last, setLast] = useState<any>(null);
  const [status, setStatus] = useState<string>("—");
  const [peekRaw, setPeekRaw] = useState<any>(null);
  const [peekNorm, setPeekNorm] = useState<any>(null);

  function refreshQueue() {
    setQueueSize(bmQueueSize());
  }

  useEffect(() => {
    setMounted(true);
    refreshQueue();

    (async () => {
      const r = await bmFlushQueues(supabase ?? undefined);
      setBoot(r);
      refreshQueue();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onTrackAndFlush() {
    setStatus("Tracking…");
    bmTrack({ event_type: "debug.test_event", source: "debug/bm", metadata: { at: new Date().toISOString() } });
    refreshQueue();

    setStatus("Flushing…");
    const r = await bmFlushQueues(supabase ?? undefined);
    setLast(r);
    refreshQueue();
    setStatus("Done.");
  }

  async function onFlushOnly() {
    setStatus("Flushing…");
    const r = await bmFlushQueues(supabase ?? undefined);
    setLast(r);
    refreshQueue();
    setStatus("Done.");
  }

  function onClearQueue() {
    bmClearQueue();
    refreshQueue();
    setLast({ flushed: 0, kept: 0, lastError: null });
    setStatus("Cleared.");
    setPeekRaw(null);
    setPeekNorm(null);
  }

  function onPeekRaw() {
    setPeekRaw(bmPeekRaw());
  }

  function onPeekNorm() {
    setPeekNorm(bmPeekNormalized());
  }

  if (!mounted) {
    return (
      <main style={{ maxWidth: 840, margin: "40px auto", padding: 16 }}>
        <h1>BetterMate Debug: BM</h1>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 840, margin: "40px auto", padding: 16 }}>
      <h1>BetterMate Debug: BM</h1>

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div>BM_LIB_VERSION: {BM_LIB_VERSION}</div>
        <div>Queue size (local): {queueSize}</div>
        <div>Boot flush: {boot ? JSON.stringify(boot) : "—"}</div>
        <div>Last action: {last ? JSON.stringify(last) : "—"}</div>
        <div>Status: {status}</div>
      </section>

      <section style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onTrackAndFlush}>Track + Flush</button>
        <button onClick={onFlushOnly}>Flush Only</button>
        <button onClick={onClearQueue}>Clear Queue</button>
        <button onClick={onPeekRaw}>Peek raw</button>
        <button onClick={onPeekNorm}>Peek normalized</button>
      </section>

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div>Peek raw (first queued item)</div>
        <pre style={{ whiteSpace: "pre-wrap" }}>{peekRaw ? JSON.stringify(peekRaw, null, 2) : "—"}</pre>
        <div>Peek normalized (what will be inserted)</div>
        <pre style={{ whiteSpace: "pre-wrap" }}>{peekNorm ? JSON.stringify(peekNorm, null, 2) : "—"}</pre>
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          If the table/RLS isn’t ready yet, events will stay queued and you’ll see lastError.
        </div>
      </section>
    </main>
  );
}
