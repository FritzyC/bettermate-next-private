'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

export const AUTH_CLIENT_RENDER = 'v4';

function safeTrim(v: string | null | undefined) {
  return (v ?? '').trim();
}

export default function AuthClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';

  const nextParam = safeTrim(sp?.get('next')) || '/';
  const inboundError = safeTrim(sp?.get('error'));
  const inboundMsg = safeTrim(sp?.get('msg'));
  const inboundErrorDesc = safeTrim(sp?.get('error_description'));

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  const callbackUrl = useMemo(() => {
    const base = siteUrl || origin || '';
    if (!base) return '';
    return `${base}/auth/callback?next=${encodeURIComponent(nextParam)}`;
  }, [siteUrl, origin, nextParam]);

  const envOk = Boolean(supabaseUrl && anonKey);

  async function continueWithGoogle() {
    setBusy(true);
    setStatus('');
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setStatus('Failed: supabase_client_missing');
        return;
      }
      if (!callbackUrl) {
        setStatus('Failed: callbackUrl_missing');
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) setStatus(`Failed: ${error.message}`);
    } catch (e: any) {
      setStatus(`Failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    setBusy(true);
    setStatus('');
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setStatus('Failed: supabase_client_missing');
        return;
      }
      if (!callbackUrl) {
        setStatus('Failed: callbackUrl_missing');
        return;
      }

      const clean = email.trim();
      if (!clean) {
        setStatus('Failed: missing_email');
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: callbackUrl },
      });

      if (error) setStatus(`Failed: ${error.message}`);
      else setStatus('Email sent. Use OTP box if the link does not open.');
    } catch (e: any) {
      setStatus(`Failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setStatus('');
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setStatus('Failed: supabase_client_missing');
        return;
      }

      const cleanEmail = email.trim();
      const cleanCode = code.trim();

      if (!cleanEmail) {
        setStatus('Failed: missing_email');
        return;
      }
      if (!cleanCode) {
        setStatus('Failed: missing_code');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });

      if (error) {
        setStatus(`Failed: ${error.message}`);
        return;
      }

      router.replace(nextParam);
    } catch (e: any) {
      setStatus(`Failed: ${e?.message ?? String(e)}`);
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
        <div>AUTH_CLIENT_RENDER={AUTH_CLIENT_RENDER}</div>
        <div>NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl || '(missing)'}</div>
        <div>hasAnonKey: {anonKey ? 'true' : 'false'}</div>
        <div>anonKeyPrefix: {anonKey ? anonKey.slice(0, 8) : '(missing)'}</div>
        <div>NEXT_PUBLIC_SITE_URL: {siteUrl || '(missing)'}</div>
        <div>origin: {origin || '(missing)'}</div>
        <div>callbackUrl: {callbackUrl || '(missing)'}</div>
        <div>next: {nextParam}</div>
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
    </main>
  );
}
