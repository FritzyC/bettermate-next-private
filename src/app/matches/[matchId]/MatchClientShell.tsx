cat > "src/app/matches/[matchId]/MatchClientShell.tsx" <<'EOF'
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

type MatchRow = {
  id: string;
  status: string | null;
  user_a_id: string | null;
  user_b_id: string | null;
  invite_id: string | null;
};

type MsgRow = {
  id: string;
  match_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

export default function MatchClientShell(props: { matchId?: string; params?: { matchId?: string } }) {
  const router = useRouter();

  const matchId = props.matchId ?? props.params?.matchId ?? '';
  const safeNext = useMemo(() => `/matches/${encodeURIComponent(matchId)}`, [matchId]);

  const [loading, setLoading] = useState(true);
  const [rtState, setRtState] = useState<'idle' | 'subscribed' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const supabaseRef = useRef<ReturnType<typeof getSupabase> | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr('');
      setRtState('idle');

      try {
        if (!matchId) {
          setErr('missing_match_id');
          setLoading(false);
          return;
        }

        const supabase = getSupabase();
        supabaseRef.current = supabase;

        if (!supabase) {
          setErr('supabase_not_ready');
          setLoading(false);
          return;
        }

        const { data: u, error: uErr } = await supabase.auth.getUser();
        const uid = u?.user?.id ?? null;

        if (uErr || !uid) {
          router.push(`/auth?next=${encodeURIComponent(safeNext)}`);
          return;
        }

        if (!alive) return;
        setUserId(uid);

        const { data: m, error: mErr } = await supabase
          .from('matches')
          .select('id,status,user_a_id,user_b_id,invite_id')
          .eq('id', matchId)
          .single();

        if (!alive) return;

        if (mErr) {
          setErr(mErr.message);
          setMatch(null);
        } else {
          setMatch(m as any as MatchRow);
        }

        const { data: initial, error: msgErr } = await supabase
          .from('messages')
          .select('id,match_id,sender_user_id,body,created_at')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true });

        if (!alive) return;

        if (msgErr) {
          setErr((prev) => prev || msgErr.message);
          setMsgs([]);
        } else {
          setMsgs((initial as any[]) as MsgRow[]);
        }

        try {
          const channel = supabase
            .channel(`messages:${matchId}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
              (payload: any) => {
                const row = payload?.new as MsgRow;
                if (!row?.id) return;
                setMsgs((prev) => {
                  if (prev.some((x) => x.id === row.id)) return prev;
                  return [...prev, row].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
                });
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') setRtState('subscribed');
            });

          if (!alive) {
            supabase.removeChannel(channel);
            return;
          }
        } catch {
          setRtState('error');
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'load_failed');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      try {
        const s = supabaseRef.current;
        if (s && matchId) {
          s.getChannels()
            .filter((c: any) => String(c?.topic ?? '').includes(`messages:${matchId}`))
            .forEach((c: any) => s.removeChannel(c));
        }
      } catch {}
    };
  }, [router, matchId, safeNext]);

  async function onSend() {
    const text = body.trim();
    if (!text) return;
    if (!userId) {
      router.push(`/auth?next=${encodeURIComponent(safeNext)}`);
      return;
    }

    const supabase = supabaseRef.current ?? getSupabase();
    if (!supabase) {
      setErr('supabase_not_ready');
      return;
    }

    setSending(true);
    setErr('');

    try {
      const { error } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: text,
      });

      if (error) {
        setErr(error.message);
        return;
      }

      setBody('');
    } catch (e: any) {
      setErr(e?.message ?? 'send_failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
      <h1>BetterMate</h1>

      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        <Link href="/debug/bm">Debug</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        <Link href="/matches">Matches</Link>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          {err && (
            <div style={{ marginTop: 10, padding: 10, background: '#fee', border: '1px solid #fbb' }}>
              Error: {err}
            </div>
          )}

          <section style={{ padding: 14, border: '1px solid #ddd', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Match: {matchId}</div>
            <div>Status: {match?.status ?? 'unknown'}</div>
            <div>User A: {match?.user_a_id ?? '(unknown)'}</div>
            <div>User B: {match?.user_b_id ?? '(unknown)'}</div>
            <div>Invite ID: {match?.invite_id ?? '(none)'}</div>
          </section>

          <section style={{ marginTop: 14, padding: 14, border: '1px solid #ddd', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Chat</div>
            <div style={{ color: '#555', marginBottom: 10 }}>
              Realtime: {rtState === 'subscribed' ? 'subscribed' : rtState === 'error' ? 'error' : 'idle'}
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, maxHeight: 320, overflow: 'auto' }}>
              {msgs.length === 0 ? (
                <div style={{ color: '#666' }}>No messages yet.</div>
              ) : (
                msgs.map((m) => {
                  const mine = userId && m.sender_user_id === userId;
                  const who = mine ? 'You' : 'Them';
                  const when = m.created_at ? new Date(m.created_at).toLocaleString() : '';
                  return (
                    <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f3f3' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        <b>{who}</b> · {when}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message…"
                style={{ flex: 1, padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
              />
              <button
                onClick={onSend}
                disabled={sending}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #333' }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
EOF