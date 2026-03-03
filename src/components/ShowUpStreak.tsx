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
const GOLD2 = '#E2C488';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const SUCCESS = '#4CAF7D';
const WARNING = '#D4A843';

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function streakLabel(n: number) {
  if (n === 0) return 'Start your streak';
  if (n === 1) return '1 date confirmed';
  if (n < 5) return n + ' dates in a row';
  if (n < 10) return n + ' — building momentum';
  if (n < 20) return n + ' — this is who you are';
  return n + ' — you show up';
}

function streakEmoji(n: number) {
  if (n === 0) return '○';
  if (n < 3) return '🌱';
  if (n < 7) return '🔥';
  if (n < 15) return '⚡';
  return '✦';
}

export default function ShowUpStreak({ userId }: { userId: string }) {
  const [streak, setStreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from('show_up_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (data) setStreak(data);
    setLoading(false);
  }

  async function useFreeze() {
    if (!streak?.freeze_available || streak?.freeze_used) return;
    setFreezing(true);
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('show_up_streaks').update({
      freeze_used: true,
      freeze_available: false,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
    await trackEvent('streak_freeze_used', { streak: streak.current_streak });
    await load();
    setFreezing(false);
  }

  if (loading) return null;

  const current = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;
  const total = streak?.total_confirmed ?? 0;
  const freezeAvailable = streak?.freeze_available ?? false;
  const freezeUsed = streak?.freeze_used ?? false;
  const lastConfirmed = streak?.last_confirmed_at;
  const daysSinceLast = lastConfirmed ? daysSince(lastConfirmed) : null;
  const atRisk = daysSinceLast !== null && daysSinceLast >= 6 && current > 0;

  const streakColor = current === 0 ? MUTED : current < 3 ? TEXT2 : current < 7 ? WARNING : GOLD;

  return (
    <div style={{ borderBottom: 'none' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) trackEvent('streak_viewed', { streak: current }); }}
        style={{
          width: '100%', padding: '14px 20px',
          background: open ? SURFACE : 'transparent',
          border: 'none', borderTop: '1px solid ' + BORDER,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>{streakEmoji(current)}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Show Up Streak</div>
            <div style={{ fontSize: 11, color: streakColor }}>{streakLabel(current)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {current > 0 && (
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '2px solid ' + streakColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: streakColor }}>{current}</span>
            </div>
          )}
          <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: '20px' }}>

          {/* Main stat */}
          <div style={{
            padding: '20px', background: ELEVATED, borderRadius: 16,
            border: '1px solid ' + BORDER, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 6, lineHeight: 1 }}>{streakEmoji(current)}</div>
            <div style={{ fontSize: 32, fontWeight: 300, color: streakColor, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
              {current}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{streakLabel(current)}</div>
            {lastConfirmed && (
              <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                Last confirmed {daysSinceLast === 0 ? 'today' : daysSinceLast === 1 ? 'yesterday' : daysSinceLast + ' days ago'}
              </div>
            )}
          </div>

          {/* At risk warning */}
          {atRisk && !freezeUsed && (
            <div style={{
              padding: '12px 16px', background: 'rgba(212,168,67,0.1)',
              border: '1px solid rgba(212,168,67,0.3)', borderRadius: 12, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: WARNING, fontWeight: 600, marginBottom: 4 }}>
                Your streak is at risk
              </div>
              <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6, marginBottom: 12 }}>
                It has been {daysSinceLast} days since your last confirmed date. Confirm a new date to keep your streak alive — or use your streak freeze.
              </div>
              {freezeAvailable && (
                <button onClick={useFreeze} disabled={freezing}
                  style={{
                    padding: '9px 18px', background: 'rgba(212,168,67,0.15)',
                    border: '1px solid rgba(212,168,67,0.4)', borderRadius: 10,
                    color: WARNING, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {freezing ? 'Freezing...' : '🧊 Use Streak Freeze'}
                </button>
              )}
            </div>
          )}

          {/* Freeze used */}
          {freezeUsed && (
            <div style={{
              padding: '10px 14px', background: 'rgba(107,163,245,0.08)',
              border: '1px solid rgba(107,163,245,0.2)', borderRadius: 10, marginBottom: 16,
              fontSize: 12, color: '#6BA3F5',
            }}>
              🧊 Streak freeze used — your streak is protected once.
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Current', value: current, color: streakColor },
              { label: 'Best', value: longest, color: GOLD },
              { label: 'Total', value: total, color: TEXT2 },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px', background: ELEVATED,
                borderRadius: 12, border: '1px solid ' + BORDER, textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Identity statement */}
          <div style={{
            padding: '14px 16px', background: 'rgba(255,255,255,0.02)',
            borderRadius: 12, border: '1px solid ' + BORDER,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: TEXT2, lineHeight: 1.7, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              {current === 0
                ? '"Every confirmed date is a vote for the person you are becoming."'
                : current < 3
                ? '"You showed up. That already makes you different."'
                : current < 7
                ? '"Consistency is rare. You are building something real."'
                : current < 15
                ? '"Your streak is proof that your intentions and your actions are aligned."'
                : '"You do not just want connection — you create it. This is who you are."'
              }
            </p>
          </div>

          {/* How it works */}
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>How it works</p>
            {[
              'Confirm a date check-in → streak increases by 1',
              'Miss a week → streak resets (one freeze available)',
              'Freeze protects your streak once — use it wisely',
              'Your best streak is always saved',
            ].map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: TEXT2, padding: '5px 0', borderBottom: i < 3 ? '1px solid ' + BORDER : 'none', lineHeight: 1.5 }}>
                · {item}
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
