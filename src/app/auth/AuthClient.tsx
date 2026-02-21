'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

function safeTrim(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function sanitizeNextPath(nextRaw: string): string {
  const s = safeTrim(nextRaw);
  if (!s) return '/';
  if (s.startsWith('http://') || s.startsWith('https://')) return '/';
  if (!s.startsWith('/')) return '/';
  return s;
}

function joinUrl(base: string, path: string): string {
  const b = (base || '').replace(/\/+$/, '');
  const p = (path || '').replace(/^\/+/, '');
  return `${b}/${p}`;
}

export default function AuthClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const spGet = (k: string) => (sp ? sp.get(k) : null);

  const inboundError = safeTrim(spGet('error'));
  const inboundMsg = safeTrim(spGet('msg'));
  const inboundErrorDesc = safeTrim(spGet('error_description'));

  const nextPath = useMemo(() => sanitizeNextPath(spGet('next') ?? '/'), [sp]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const siteUrlEnv = process.env.NEXT_PUBLIC_SITE_URL || '';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const siteUrl = siteUrlEnv || origin;

  const callbackUrl = useMemo(() => {
    const base = siteUrl || origin;
    const cb = joinUrl(base, 'auth/callback');
    const url = new URL(cb);
    url.searchParams.set('next', nextPath);
    return url.toString();
  }, [siteUrl, origin, nextPath]);

  const envOk = Boolean(supabaseUrl && anonKey && siteUrl);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  async function continueWithGoogle() {
    setStatus('');
    if (!envOk) {
      setStatus('Failed: env_missing');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setStatus('Failed: supabase_client_missing');
      return;
    }

    try {
      setBusy(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) {
        setStatus(`Failed: ${error.message}`);
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setStatus('Failed: oauth_no_url');
    } catch (e: any) {
      setStatus(`Failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    setStatus('');
    if (!envOk) {
      setStatus('Failed: env_missing');
      return;
    }

    const e = safeTrim(email);
    if (!e) {
      setStatus('Failed: missing_email');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setStatus('Failed: supabase_client_missing');
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        setStatus(`Failed: ${error.message}`);
        return;
      }

      setStatus('Email sent. If the link does not open, paste the OTP code below and verify.');
    } catch (err: any) {
      setStatus(`Failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setStatus('');
    if (!envOk) {
      setStatus('Failed: env_missing');
      return;
    }

    const e = safeTrim(email);
    const c = safeTrim(code);

    if (!e) {
      setStatus('Failed: missing_email');
      return;
    }
    if (!c) {
      setStatus('Failed: missing_code');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setStatus('Failed: supabase_client_missing');
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.verifyOtp({
        email: e,
        token: c,
        type: 'email',
      });

      if (error) {
        setStatus(`Failed: ${error.message}`);
        return;
      }

      router.replace(nextPath);
    } catch (err: any) {
      setStatus(`Failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720 }}>
      <h1>BetterMate Login</h1>

      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        <Link href="/debug/bm">Debug</Link>
      </div>

      <section style={{ padding: 14, border: '1px solid #ddd', borderRadius: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Debug</div>
        <div>AUTH_CLIENT_RENDER=v3</div>
        <div>NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl || '(missing)'}</div>
        <div>hasAnonKey: {anonKey ? 'true' : 'false'}</div>
        <div>anonKeyPrefix: {anonKey ? anonKey.slice(0, 8) : '(missing)'}</div>
        <div>NEXT_PUBLIC_SITE_URL: {siteUrlEnv || '(missing)'} </div>
        <div>origin: {origin || '(missing)'}</div>
        <div>callbackUrl: {callbackUrl || '(missing)'}</div>
        <div>next: {nextPath}</div>
        <div>env: {envOk ? 'OK' : 'MISSING'}</div>

        {(inboundError || inboundMsg || inboundErrorDesc) && (
          <div style={{ marginTop: 10, padding: 10, background: '#fee', border: '1px solid #fbb' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Inbound</div>
            {inboundError && <div>error: {inboundError}</div>}
            {inboundErrorDesc && <div>error_description: {inboundErrorDesc}</div>}
            {inboundMsg && <div>msg: {inboundMsg}</div>}
          </div>
        )}
      </section>

      <section style={{ marginTop: 16, padding: 14, border: '1px solid #ddd', borderRadius: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Fast login (recommended)</div>

        <button
          onClick={continueWithGoogle}
          disabled={busy || !envOk}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #333',
            width: '100%',
            fontWeight: 600,
          }}
        >
          {busy ? 'Working…' : 'Continue with Google'}
        </button>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee' }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Email OTP (may rate-limit)</div>

          <label htmlFor="bm_email" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Email
          </label>
          <input
            id="bm_email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              onClick={sendEmail}
              disabled={busy || !envOk}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #333' }}
            >
              Send email
            </button>
          </div>

          <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid #eee' }}>
            <label htmlFor="bm_otp" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              OTP code (use this if links don’t open)
            </label>
            <input
              id="bm_otp"
              name="otp"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code from email"
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                onClick={verifyCode}
                disabled={busy || !envOk}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #333' }}
              >
                Verify OTP & Sign in
              </button>
            </div>
          </div>
        </div>

        {status && (
          <p style={{ marginTop: 12, color: status.toLowerCase().includes('failed') ? '#b00020' : '#222' }}>
            {status}
          </p>
        )}
      </section>

      <section style={{ marginTop: 18, fontSize: 13, color: '#444' }}>
        <p>
          If you open an email on your phone, your device cannot use <code>http://localhost:3000</code>.
          For local dev, prefer the OTP code field or set <code>NEXT_PUBLIC_SITE_URL</code> to a reachable URL.
        </p>
      </section>
    </main>
  );
}
