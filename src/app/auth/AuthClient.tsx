'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

export function AuthClient(): React.ReactElement {
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get('next') ?? '/matches';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setCheckingSession(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = nextPath;
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
    if (error) { setMessage(error.message); setLoading(false); }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !email) return;
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setStep('code');
      setMessage('');
    }
    setLoading(false);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !code) return;
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      window.location.href = nextPath;
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
    boxSizing: 'border-box' as const,
    fontFamily: 'Georgia, serif',
    outline: 'none',
  };

  const btnPrimary = {
    width: '100%',
    padding: '14px 0',
    background: 'linear-gradient(135deg, #7c3aed, #db2777)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    letterSpacing: 0.3,
  };

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a041a 0%, #10062a 50%, #0a041a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#7A6A96', fontFamily: 'Georgia, serif' }}>Checking session…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a041a 0%, #10062a 50%, #0a041a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: 'Georgia, serif' }}>
      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(219,39,119,0.07) 100%)', border: '1px solid rgba(124,58,237,0.28)', borderRadius: 20, padding: '40px 32px', maxWidth: 400, width: '100%' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/bettermate-logo.png" alt="BetterMate" style={{ width: 64, height: 'auto', mixBlendMode: 'screen', marginBottom: 16 }} />
          <p style={{ color: '#7A6A96', fontSize: 13, margin: 0 }}>
            {step === 'email' ? 'Sign in to continue' : 'Check your email'}
          </p>
        </div>

        {step === 'email' ? (
          <>
            <button onClick={handleGoogleLogin} disabled={loading}
              style={{ width: '100%', padding: '13px 0', background: '#fff', color: '#111', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 20, fontFamily: 'Georgia, serif' }}>
              {loading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: '#3a2a55', fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <form onSubmit={handleSendCode}>
              <input type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              <button type="submit" disabled={loading || !email} style={btnPrimary}>
                {loading ? 'Sending…' : 'Send Sign-In Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ color: '#b09fd0', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px', textAlign: 'center' }}>
              We sent a 6-digit code to<br />
              <span style={{ color: '#C9A96E' }}>{email}</span>
            </p>

            <form onSubmit={handleVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="00000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                required
                autoFocus
                style={{ ...inputStyle, fontSize: 28, textAlign: 'center', letterSpacing: 8, fontFamily: 'system-ui' }}
              />
              <button type="submit" disabled={loading || code.length < 6 || code.length > 8} style={btnPrimary}>
                {loading ? 'Verifying…' : 'Continue'}
              </button>
            </form>

            <button onClick={() => { setStep('email'); setCode(''); setMessage(''); }}
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#3a2a55', fontSize: 12, cursor: 'pointer', marginTop: 16, fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>
              Use a different email
            </button>
          </>
        )}

        {message && (
          <p style={{ marginTop: 16, color: '#f87171', textAlign: 'center', fontSize: 13 }}>{message}</p>
        )}
      </div>
    </div>
  );
}
