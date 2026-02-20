'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type MatchRow = {
  id: string;
  user_a_id: string | null;
  user_b_id: string | null;
  invite_id: string | null;
  status: string | null;
  created_at?: string | null;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
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

export default function MatchClientShell({ matchId }: { matchId: string }) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  const nextUrl = useMemo(() => `/matches/${encodeURIComponent(matchId)}`, [matchId]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [match, setMatch] = useState<MatchRow | null>(null);

  const [userId, setUserId] = useState<string>('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);
  const [msgErr, setMsgErr] = useState('');
  const [rtStatus, setRtStatus] = useState<'off' | 'connecting' | 'subscribed' | 'error' | 'polling'>('off');

  const [client, setClient] = useState<ReturnType<typeof createClient> | null>(null);

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function mergeMessages(next: MessageRow[]) {
    // normalize + unique by id
    const map = new Map<string, MessageRow>();
    for (const m of next) map.set(m.id, m);
    setMessages((prev) => {
      for (const m of prev) map.set(m.id, m);
      const merged = Array.from(map.values());
      merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return merged;
    });
    setTimeout(scrollToBottom, 0);
  }

  function addMessage(m: MessageRow) {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev;
      const next = [...prev, m];
      next.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return next;
    });
    setTimeout(scrollToBottom, 0);
  }

  useEffect(() => {
    let alive = true;
    let cleanupRealtime: null | (() => void) = null;
    let pollTimer: any = null;

    (async () => {
      setLoading(true);
      setErr('');
      setMsgErr('');
      setRtStatus('off');

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

      // Realtime auth (best-effort)
      try {
        c.realtime.setAuth(accessToken);
      } catch {}

      // Validate token and get user (explicit token)
      const { data: u, error: uErr } = await c.auth.getUser(accessToken);
      const user = u?.user;

      if (uErr || !user?.id) {
        router.push(`/auth?next=${encodeURIComponent(nextUrl)}`);
        return;
      }

      if (!alive) return;

      setClient(c);
      setUserId(user.id);

      const { data: row, error: matchErr } = await c
        .from('matches')
        .select('id,user_a_id,user_b_id,invite_id,status,created_at')
        .eq('id', matchId)
        .maybeSingle();

      if (!alive) return;

      if (matchErr) {
        setErr(matchErr.message || 'match_fetch_error');
        setMatch(null);
        setLoading(false);
        return;
      }
      if (!row) {
        setErr('match_not_found_or_rls');
        setMatch(null);
        setLoading(false);
        return;
      }

      setMatch(row as MatchRow);

      async function fetchMessages() {
        const { data: msgs, error: msgsErr } = await c
          .from('messages')
          .select('id,match_id,sender_user_id,body,created_at')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true });

        if (!alive) return;

        if (msgsErr) {
          setMsgErr(msgsErr.message || 'messages_fetch_error');
          return;
        }
        mergeMessages((msgs || []) as MessageRow[]);
      }

      await fetchMessages();

      // behavior event: match open (best-effort)
      try {
        const dedup_key = `match_open:${user.id}:${matchId}`;
        await c.from('behavior_events').insert({
          dedup_key,
          event_type: 'match_open',
          source: 'page',
          created_at: new Date().toISOString(),
          user_id: user.id,
          match_id: matchId,
          metadata: { path: nextUrl },
        });
      } catch {}

      setLoading(false);

      // Start polling fallback immediately (will be stopped if realtime subscribes)
      setRtStatus('polling');
      pollTimer = setInterval(fetchMessages, 2500);

      // Try realtime subscription; if it subscribes, stop polling
      try {
        setRtStatus('connecting');
        const channel = c
          .channel(`messages:${matchId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
            (payload) => {
              const m = payload.new as MessageRow;
              addMessage(m);
            }
          )
          .subscribe((status) => {
            if (!alive) return;
            if (status === 'SUBSCRIBED') {
              setRtStatus('subscribed');
              if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
              }
            }
          });

        cleanupRealtime = () => {
          try {
            c.removeChannel(channel);
          } catch {}
        };
      } catch {
        setRtStatus('polling');
      }
    })();

    return () => {
      alive = false;
      if (cleanupRealtime) cleanupRealtime();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [matchId, nextUrl, router, supabaseUrl, publicKey]);

  async function onSend() {
    setMsgErr('');
    if (!client) return;
    if (!msgBody.trim()) return;

    setSending(true);
    try {
      const body = msgBody.trim();
      setMsgBody('');

      const { data: inserted, error } = await client
        .from('messages')
        .insert({
          match_id: matchId,
          sender_user_id: userId,
          body,
        })
        .select('id,match_id,sender_user_id,body,created_at')
        .single();

      if (error) {
        setMsgErr(error.message || 'send_failed');
        setMsgBody(body);
        return;
      }

      if (inserted) addMessage(inserted as MessageRow);

      // behavior event: message send (dedup on message id)
      try {
        const msgId = (inserted as any)?.id || 'unknown';
        const dedup_key = `message_send:${userId}:${msgId}`;
        await client.from('behavior_events').insert({
          dedup_key,
          event_type: 'message_send',
          source: 'page',
          created_at: new Date().toISOString(),
          user_id: userId,
          match_id: matchId,
          message_id: msgId,
          metadata: { len: body.length },
        });
      } catch {}
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
      <h1>BetterMate</h1>

      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        <Link href="/debug/bm">Debug</Link>
      </div>

      <div style={{ marginBottom: 12 }}>
        <b>Match:</b> {matchId}
      </div>

      {loading && <div>Loading match…</div>}

      {!loading && err && (
        <div style={{ marginTop: 12, padding: 12, background: '#fee', border: '1px solid #fbb' }}>
          Error: {err}
        </div>
      )}

      {!loading && !err && match && (
        <>
          <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <div>
              <b>Status:</b> {match.status ?? '(null)'}
            </div>
            <div>
              <b>User A:</b> {match.user_a_id ?? '(null)'}
            </div>
            <div>
              <b>User B:</b> {match.user_b_id ?? '(null)'}
            </div>
            <div>
              <b>Invite ID:</b> {match.invite_id ?? '(null)'}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Chat</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Realtime: {rtStatus}</div>
            </div>

            {msgErr && (
              <div style={{ marginBottom: 10, padding: 10, background: '#fee', border: '1px solid #fbb' }}>
                Message error: {msgErr}
              </div>
            )}

            <div
              ref={listRef}
              style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #eee', padding: 10 }}
            >
              {messages.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {m.sender_user_id === userId ? 'You' : m.sender_user_id} ·{' '}
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Type a message…"
                style={{ flex: 1, padding: 10 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
              />
              <button onClick={onSend} disabled={sending || !msgBody.trim()} style={{ padding: '10px 14px' }}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
