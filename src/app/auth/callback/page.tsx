'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

function sanitizeNext(next: string | null): string {
  if (!next) return '/matches';
  if (next.startsWith('/')) return next;
  return '/matches';
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => sanitizeNext(searchParams ? searchParams.get('next') : null), [searchParams]);
  const code = searchParams ? searchParams.get('code') : null;
  const oauthError = searchParams ? (searchParams.get('error') || searchParams.get('error_description')) : null;
  const [status, setStatus] = useState('Completing sign-in...');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = getSupabase();
      if (!supabase) {
        if (!cancelled) router.replace('/auth?error=no_client');
        return;
      }

      setStatus('Finalizing session...');

      try {
        if (oauthError) {
          if (!cancelled) router.replace('/auth?error=oauth_error&next=' + encodeURIComponent(next));
          return;
        }

        if (code) {
          setStatus('Exchanging OAuth code...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error('Exchange error:', error.message);
        }

        setStatus('Checking session...');
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;

        if (session?.user?.id) {
          if (!cancelled) router.replace(next);
          return;
        }

        if (!cancelled) router.replace('/auth?error=missing_session&next=' + encodeURIComponent(next));
      } catch (e: any) {
        if (!cancelled) router.replace('/auth?error=callback_exception&next=' + encodeURIComponent(next));
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [router, next, code, oauthError]);

  return (
    <main style={{ padding: 24, maxWidth: 520, margin: '0 auto', fontFamily: 'system-ui', color: '#fff' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Signing you in</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>{status}</p>
      <p style={{ marginTop: 20, opacity: 0.75, fontSize: 14 }}>
        If this does not complete, go back to <a href={'/auth?next=' + encodeURIComponent(next)} style={{ color: '#6366f1' }}>sign in</a> and try again.
      </p>
    </main>
  );
}
