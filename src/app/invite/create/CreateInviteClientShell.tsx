'use client';

import { useState } from 'react';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { getSupabase } from '@/lib/supabaseClient';

export default function CreateInviteClientShell() {
  useOnboardingGuard();
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onCreateInvite() {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const sb = getSupabase();
      const sessionResult = sb ? await sb.auth.getSession() : null;
      const accessToken = sessionResult?.data?.session?.access_token ?? null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch('/api/invites/create', {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.error) {
        if (res.status === 401) {
          setError('You must be logged in to create an invite.');
        } else {
          setError(String(data?.error ?? 'invite_create_failed'));
        }
        return;
      }

      setInviteUrl(data.invite_url ?? null);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'network_error');
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore – clipboard not available
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 520 }}>
      <h1>BetterMate</h1>
      <h2 style={{ marginTop: 8 }}>Create Invite</h2>
      <p style={{ color: '#555' }}>
        Generate a shareable invite link. The link expires in 7&nbsp;days.
      </p>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: '#fee',
            border: '1px solid #fbb',
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}

      {!inviteUrl ? (
        <button
          onClick={onCreateInvite}
          disabled={loading}
          style={{ marginTop: 16, padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Creating…' : 'Create Invite'}
        </button>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 600 }}>Your invite link:</p>
          <div
            style={{
              marginTop: 8,
              padding: 10,
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: 6,
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              fontSize: 13,
            }}
          >
            {inviteUrl}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button
              onClick={onCopy}
              style={{ padding: '8px 16px', cursor: 'pointer' }}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => {
                setInviteUrl(null);
                setError(null);
              }}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                background: '#eee',
                border: '1px solid #ccc',
              }}
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
