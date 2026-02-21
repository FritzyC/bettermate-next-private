'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

type TestState = 'idle' | 'loading' | 'ok' | 'error';

export default function SupabaseDebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  const anonPrefix = useMemo(() => {
    if (!anonKey) return '';
    return anonKey.slice(0, 10) + '…';
  }, [anonKey]);

  const [state, setState] = useState<TestState>('idle');
  const [detail, setDetail] = useState<string>('');

  async function testConnection() {
    setState('loading');
    setDetail('');

    if (!supabaseUrl || !anonKey) {
      setState('error');
      setDetail('missing_env');
      return;
    }

    try {
      // Health endpoints vary; this is a safe “reachability” probe.
      // We treat any HTTP response as "reachable", but show status code.
      const url = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: 'application/json',
        },
      });

      const txt = await res.text().catch(() => '');
      if (res.ok) {
        setState('ok');
        setDetail(`ok (${res.status}) ${txt ? `- ${txt.slice(0, 120)}` : ''}`.trim());
      } else {
        // Non-200 still proves the endpoint is reachable; show status for debugging.
        setState('error');
        setDetail(`reachable_but_non_200 (${res.status}) ${txt ? `- ${txt.slice(0, 120)}` : ''}`.trim());
      }
    } catch (e: any) {
      setState('error');
      setDetail(e?.message || 'network_error');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 860 }}>
      <h1>BetterMate</h1>

      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        <Link href="/debug/bm">Debug</Link>
      </div>

      <h2>Supabase environment check</h2>
      <div style={{ opacity: 0.85, marginBottom: 12 }}>
        This page should never blank out. If env keys are missing, you’ll see it here.
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <b>ENV:</b> {supabaseUrl && anonKey ? 'OK' : 'MISSING'}
        </div>

        <div style={{ marginBottom: 6 }}>
          <b>NEXT_PUBLIC_SUPABASE_URL:</b> {supabaseUrl || '(missing)'}
        </div>

        <div style={{ marginBottom: 6 }}>
          <b>NEXT_PUBLIC_SUPABASE_ANON_KEY:</b> {anonKey ? anonPrefix : '(missing)'}
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={testConnection} disabled={state === 'loading'} style={{ padding: '10px 14px' }}>
            {state === 'loading' ? 'Testing…' : 'Test Supabase Connection'}
          </button>
          <div>
            {state === 'idle' && <span>—</span>}
            {state === 'ok' && <span>Supabase reachable ✅ {detail ? `(${detail})` : ''}</span>}
            {state === 'error' && (
              <span style={{ color: '#a00' }}>
                Supabase check failed ❌ {detail ? `(${detail})` : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
