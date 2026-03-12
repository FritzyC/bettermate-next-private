
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

export function AuthClient(): React.ReactElement {
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get('next') ?? '/matches';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setCheckingSession(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/matches';
      else setCheckingSession(false);
    });
  }, []);

  async function handleGoogleLogin() {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  async function handleEmailOTP(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for a login link.');
    }
    setLoading(false);
  }

  if (checkingSession) {
    return (
      <main style={{ maxWidth: 400, margin: '80px auto', padding: 24, fontFamily: 'system-ui', color: '#fff' }}>
        <p>Checking session…</p>
      </main>
    );
  }

  return (
    <main style={{
      maxWidth: 400,
      margin: '80px auto',
      padding: 32,
      fontFamily: 'system-ui',
      background: '#111',
      borderRadius: 16,
      border: '1px solid #222',
      color: '#fff',
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>BetterMate</h1>
      <p style={{ color: '#888', marginBottom: 32 }}>Sign in to continue</p>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px 0',
          background: '#fff',
          color: '#111',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 16,
          cursor: 'pointer',
          marginBottom: 24,
        }}
      >
        {loading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div style={{ textAlign: 'center', color: '#555', marginBottom: 24 }}>or</div>

      <form onSubmit={handleEmailOTP}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#fff',
            fontSize: 16,
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          disabled={loading || !email}
          style={{
            width: '100%',
            padding: '12px 0',
            background: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Sending…' : 'Send Magic Link'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 16, color: '#6366f1', textAlign: 'center' }}>{message}</p>
      )}
    </main>
  );
}