'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';

const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const GOLD = '#C9A96E';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const SUCCESS = '#4CAF7D';

function isQualifying(body: string): boolean {
  if (!body || typeof body !== 'string') return false;
  const trimmed = body.trim();
  if (trimmed.length < 3) return false;
  const words = trimmed.split(/\s+/).filter(w => /[a-zA-Z0-9]/.test(w));
  if (words.length < 2 && trimmed.length < 12) return false;
  const nonEmoji = trimmed.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '').trim();
  if (nonEmoji.length < 2) return false;
  return true;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

function formatCountdown(iso: string): string {
  const remaining = 24 * 3600000 - (Date.now() - new Date(iso).getTime());
  if (remaining <= 0) return 'Ready to reveal';
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return h + 'h ' + m + 'm until auto-reveal';
}

export default function BlindChat({
  matchId,
  userId,
  onReveal,
}: {
  matchId: string;
  userId: string;
  onReveal?: () => void;
}) {
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => { load(); }, [matchId, userId]);

  useEffect(() => {
    if (!match?.blind_chat_started_at || match?.blind_revealed) return;
    const interval = setInterval(() => {
      setCountdown(formatCountdown(match.blind_chat_started_at));
      checkRevealConditions(match);
    }, 60000);
    setCountdown(formatCountdown(match.blind_chat_started_at));
    return () => clearInterval(interval);
  }, [match]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (data) {
      if (!data.blind_chat_started_at) {
        const { data: updated } = await supabase
          .from('matches')
          .update({ blind_chat_started_at: new Date().toISOString() })
          .eq('id', matchId).select().single();
        setMatch(updated);
        await trackEvent('blind_chat_started', {}, matchId);
      } else {
        setMatch(data);
        if (data.blind_revealed) {
          setRevealed(true);
          onReveal?.();
        } else {
          await checkRevealConditions(data);
        }
      }
    }
    setLoading(false);
  }

  async function checkRevealConditions(matchData: any) {
    if (!matchData?.blind_chat_started_at || matchData?.blind_revealed) return;
    setChecking(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const isUser1 = matchData.user1_id === userId;
    const myCount = isUser1 ? matchData.user1_qualifying_msgs : matchData.user2_qualifying_msgs;
    const theirCount = isUser1 ? matchData.user2_qualifying_msgs : matchData.user1_qualifying_msgs;
    const timeElapsed = hoursSince(matchData.blind_chat_started_at) >= 24;
    const mutualThreshold = myCount >= 3 && theirCount >= 3;

    if (timeElapsed && mutualThreshold) {
      const reason = 'mutual_interactions';
      const { data: updated } = await supabase
        .from('matches')
        .update({ blind_revealed: true, blind_revealed_at: new Date().toISOString(), blind_reveal_reason: reason })
        .eq('id', matchId).select().single();
      setMatch(updated);
      setRevealed(true);
      await trackEvent('blind_chat_revealed', { reason }, matchId);
      onReveal?.();
    }
    setChecking(false);
  }

  if (loading) return null;
  if (!match) return null;

  const isUser1 = match.user1_id === userId;
  const myCount = Math.min(isUser1 ? match.user1_qualifying_msgs : match.user2_qualifying_msgs, 3);
  const theirCount = Math.min(isUser1 ? match.user2_qualifying_msgs : match.user1_qualifying_msgs, 3);
  const THRESHOLD = 3;

  if (revealed || match.blind_revealed) {
    return (
      <div style={{ padding: '10px 14px', background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', borderRadius: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>✨</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: SUCCESS }}>Photos unlocked</div>
          <div style={{ fontSize: 11, color: MUTED }}>
            {match.blind_reveal_reason === 'mutual_interactions'
              ? 'You both showed up. 24 hours passed and you each sent 3+ messages.'
              : 'Blind chat period complete.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 16px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 14, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🫥</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>Blind Chat</div>
          <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6 }}>
            Photos unlock after 24 hours — once you've each sent at least 3 meaningful messages. Both conditions must be met.
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        {[
          { label: 'You', count: myCount, color: myCount >= THRESHOLD ? SUCCESS : BRAND },
          { label: 'Them', count: theirCount, color: theirCount >= THRESHOLD ? SUCCESS : 'rgba(132,82,184,0.6)' },
        ].map((row, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: TEXT2 }}>{row.label}</span>
              <span style={{ fontSize: 11, color: row.count >= THRESHOLD ? SUCCESS : MUTED }}>{row.count}/{THRESHOLD}</span>
            </div>
            <div style={{ height: 4, background: SURFACE, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (row.count / THRESHOLD * 100) + '%', background: row.color, borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: MUTED }}>⏱ {countdown || formatCountdown(match.blind_chat_started_at)}</span>
        <button onClick={() => checkRevealConditions(match)} disabled={checking}
          style={{ background: 'none', border: 'none', color: MUTED, fontSize: 11, cursor: 'pointer' }}>
          {checking ? '...' : '↻ Check'}
        </button>
      </div>
    </div>
  );
}

export { isQualifying };
