'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type BehaviorEventInsert = {
  dedup_key: string;
  event_type: string;
  source: string;
  created_at: string;
  user_id?: string;
  invite_id?: string;
  match_id?: string;
  metadata?: Record<string, any>;
};

const BEHAVIOR_QUEUE_KEY = 'bm_behavior_queue_v1';
const GLOBAL_SUPABASE_KEY = '__bm_supabase_browser_singleton__';

function getSupabase(): SupabaseClient {
  const g = globalThis as any;
  if (g[GLOBAL_SUPABASE_KEY]) return g[GLOBAL_SUPABASE_KEY];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  g[GLOBAL_SUPABASE_KEY] = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return g[GLOBAL_SUPABASE_KEY];
}

function sanitizeNext(raw: string | null): string {
  if (!raw) return '/matches';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/matches';
}

function readQueue(): BehaviorEventInsert[] {
  try {
    const raw = localStorage.getItem(BEHAVIOR_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BehaviorEventInsert[];
  } catch {
    return [];
  }
}

function writeQueue(items: BehaviorEventInsert[]) {
  try {
    localStorage.setItem(BEHAVIOR_QUEUE_KEY, JSON.stringify(items.slice(-200)));
  } catch {
    return;
  }
}

function enqueue(evt: BehaviorEventInsert) {
  const q = readQueue();
  q.push(evt);
  writeQueue(q);
}

async function flushQueue(supabase: SupabaseClient) {
  const q = readQueue();
  if (!q.length) return;

  const chunk = q.slice(0, 25);
  const rest = q.slice(25);

  const { error } = await supabase.from('behavior_events').insert(chunk);
  if (error) return;

  writeQueue(rest);
  if (rest.length) {
    // best-effort cascade
    void flushQueue(supabase);
  }
}

function makeDedupKey(event_type: string, userId: string | undefined, extra: string) {
  const minute = new Date().toISOString().slice(0, 16);
  return `authcb:${event_type}:${userId ?? 'anon'}:${minute}:${extra}`;
}

async function safeLog(
  supabase: SupabaseClient,
  evt: Omit<BehaviorEventInsert, 'created_at' | 'dedup_key'> & { dedup_key?: string }
) {
  try {
    const created_at = new Date().toISOString();
    const dedup_key =
      evt.dedup_key ??
      makeDedupKey(evt.event_type, evt.user_id, `${evt.source}:${(evt.metadata?.mode ?? 'na') as string}`);

    const payload: BehaviorEventInsert = {
      dedup_key,
      event_type: evt.event_type,
      source: evt.source,
      created_at,
      ...(evt.user_id ? { user_id: evt.user_id } : {}),
      ...(evt.invite_id ? { invite_id: evt.invite_id } : {}),
      ...(evt.match_id ? { match_id: evt.match_id } : {}),
      ...(evt.metadata ? { metadata: evt.metadata } : {}),
    };

    const { error } = await supabase.from('behavior_events').insert(payload);
    if (error) enqueue(payload);
  } catch {
    try {
      const created_at = new Date().toISOString();
      const payload: BehaviorEventInsert = {
        dedup_key: evt.dedup_key ?? makeDedupKey(evt.event_type, evt.user_id, `${evt.source}:catch`),
        event_type: evt.event_type,
        source: evt.source,
        created_at,
        ...(evt.user_id ? { user_id: evt.user_id } : {}),
        ...(evt.metadata ? { metadata: evt.metadata } : {}),
      };
      enqueue(payload);
    } catch {
      return;
    }
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = useMemo(() => sanitizeNext(searchParams.get('next')), [searchParams]);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error') || searchParams.get('error_description');

  const [status, setStatus] = useState<string>('Completing sign-in…');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = getSupabase();

      const hasHash =
        typeof window !== 'undefined' &&
        (window.location.hash.includes('access_token=') ||
          window.location.hash.includes('refresh_token=') ||
          window.location.hash.includes('type=magiclink'));

      setStatus('Finalizing session…');

      try {
        // 0) flush any queued events first (best-effort)
        await flushQueue(supabase);

        // 1) If provider returned an explicit error
        if (oauthError) {
          await safeLog(supabase, {
            event_type: 'auth.oauth_callback_failed',
            source: 'auth/callback',
            metadata: { reason: 'provider_error', oauthError },
          });
          if (!cancelled) router.replace(`/auth?error=oauth_error&next=${encodeURIComponent(next)}`);
          return;
        }

        // 2) PKCE code flow
        if (code) {
          setStatus('Exchanging OAuth code…');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            await safeLog(supabase, {
              event_type: 'auth.oauth_exchange_failed',
              source: 'auth/callback',
              metadata: { message: error.message },
            });
          }
        }

        // 3) URL token/hash flow (magiclink / implicit)
        if (!code && hasHash) {
          setStatus('Storing session from URL…');
          const { error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
          if (error) {
            await safeLog(supabase, {
              event_type: 'auth.oauth_hash_failed',
              source: 'auth/callback',
              metadata: { message: error.message },
            });
          }
        }

        // 4) Existing session fallback
        setStatus('Checking session…');
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;

        if (session?.user?.id) {
          await safeLog(supabase, {
            event_type: 'auth.oauth_callback_success',
            source: 'auth/callback',
            user_id: session.user.id,
            metadata: { mode: code ? 'pkce_code' : hasHash ? 'url_hash' : 'existing_session', next },
          });

          // attempt one more queue flush now that we have a user context
          await flushQueue(supabase);

          if (!cancelled) router.replace(next);
          return;
        }

        await safeLog(supabase, {
          event_type: 'auth.oauth_callback_failed',
          source: 'auth/callback',
          metadata: { reason: 'no_session', mode: code ? 'pkce_code' : hasHash ? 'url_hash' : 'none' },
        });

        if (!cancelled) router.replace(`/auth?error=missing_session&next=${encodeURIComponent(next)}`);
      } catch (e: any) {
        try {
          const supabase = getSupabase();
          await safeLog(supabase, {
            event_type: 'auth.oauth_callback_failed',
            source: 'auth/callback',
            metadata: { reason: 'exception', message: e?.message ?? String(e) },
          });
        } catch {
          // ignore
        }
        if (!cancelled) router.replace(`/auth?error=callback_exception&next=${encodeURIComponent(next)}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, next, code, oauthError]);

  return (
    <main style={{ padding: 24, maxWidth: 520, margin: '0 auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Signing you in</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>{status}</p>
      <p style={{ marginTop: 20, opacity: 0.75, fontSize: 14 }}>
        If this doesn’t complete, go back to <a href={`/auth?next=${encodeURIComponent(next)}`}>Auth</a> and try again.
      </p>
    </main>
  );
}