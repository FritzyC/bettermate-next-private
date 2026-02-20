'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

type MatchRow = {
  id: string;
  user_a_id: string | null;
  user_b_id: string | null;
  invite_id: string | null;
  status: string | null;
  created_at: string | null;
};

function getAccessTokenFromLocalStorage(): string | null {
  try {
    const preferred = 'sb-ukxraiiwgiroiqxtyiml-auth-token';
    const preferredRaw = localStorage.getItem(preferred);
    if (preferredRaw) {
      const parsed = JSON.parse(preferredRaw);
      const sess =
        parsed?.session ||
        parsed?.currentSession ||
        parsed?.data?.session ||
        (parsed?.access_token ? parsed : null);
      if (typeof sess?.access_token === 'string') return sess.access_token;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.includes('auth-token')) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const sess =
        parsed?.session ||
        parsed?.currentSession ||
        parsed?.data?.session ||
        (parsed?.access_token ? parsed : null);
      if (typeof sess?.access_token === 'string') return sess.access_token;
    }
  } catch {}
  return null;
}

export default function MatchesClientShell() {
  const router = useRouter();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  const nextUrl = useMemo(() => `/matches`, []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [rows, setRows] = useState<MatchRow[]>([]);

  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [inviteErr, setInviteErr] = useState<string>('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createInviteLink() {
    setInviteErr('');
    setInviteUrl('');
    setCopied(false);

    const accessToken = getAccessTokenFromLocalStorage();
    if (!accessToken) {
      router.push(`/auth?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    setCreatingInvite(true);
    try {
      const res = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.invite_url) {
        setInviteErr(data?.error || 'invite_create_failed');
        return;
      }
      setInviteUrl(String(data.invite_url));
    } catch (e: any) {
      setInviteErr(e?.message || 'invite_create_failed');
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyInvite() {
    setCopied(false);
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: user can manually copy
      setCopied(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr('');

      if (!supabaseUrl || !publicKey) {
        setErr('missing_supabase_public_env');
        setLoading(false);
        return;
      }

      const accessToken = getAccessTokenFromLocalStorage();
      if (!accessToken) {
        router.push(`/auth?next=${encodeURIComponent(nextUrl)}`);
        return;
      }

      const c = createClient(supabaseUrl, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      const { data: u, error: uErr } = await c.auth.getUser(accessToken);
      const user = u?.user;

      if (uErr || !user?.id) {
        router.push(`/auth?next=${encodeURIComponent(nextUrl)}`);
        return;
      }

      if (!alive) return;
      setUserId(user.id);

      const { data, error } = await c
        .from('matches')
        .select('id,user_a_id,user_b_id,invite_id,status,created_at')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (error) {
        setErr(error.message || 'matches_fetch_error');
        setRows([]);
      } else {
        setRows((data || []) as MatchRow[]);
      }

      // behavior event: matches list view (best-effort)
      try {
        const dedup_key = `matches_list_open:${user.id}:${Date.now()}`;
        await c.from('behavior_events').insert({
          dedup_key,
          event_type: 'matches_list_open',
          source: 'page',
          created_at: new Date().toISOString(),
          user_id: user.id,
          metadata: { count: (data || []).length },
        });
      } catch {}

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, supabaseUrl, publicKey, nextUrl]);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 860 }}>
      <h1>BetterMate</h1>

      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        <Link href="/debug/bm">Debug</Link>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <b style={{ flex: 1 }}>Your Matches</b>
        <button onClick={createInviteLink} disabled={creatingInvite} style={{ padding: '10px 14px' }}>
          {creatingInvite ? 'Creating…' : 'Create Invite Link'}
        </button>
      </div>

      {inviteErr && (
        <div style={{ marginBottom: 12, padding: 12, background: '#fee', border: '1px solid #fbb' }}>
          Invite error: {inviteErr}
        </div>
      )}

      {inviteUrl && (
        <div style={{ marginBottom: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Private invite link</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={inviteUrl} readOnly style={{ flex: 1, padding: 10 }} />
            <button onClick={copyInvite} style={{ padding: '10px 14px' }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Send this link to one person. They must log in, then Accept Invite.
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}

      {!loading && err && (
        <div style={{ marginTop: 12, padding: 12, background: '#fee', border: '1px solid #fbb' }}>
          Error: {err}
        </div>
      )}

      {!loading && !err && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.75 }}>No matches yet.</div>
          ) : (
            rows.map((m, idx) => {
              const other =
                m.user_a_id === userId ? m.user_b_id : m.user_b_id === userId ? m.user_a_id : m.user_a_id;
              return (
                <div key={m.id} style={{ padding: 12, borderTop: idx === 0 ? 'none' : '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{other ?? '(unknown)'}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {m.status ?? 'unknown'} · {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                    <div>
                      <Link href={`/matches/${m.id}`}>Open</Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
