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
const WARNING = '#D4A843';
const ERROR = '#C0444B';
const ACCENT = '#8452B8';

const TIERS = [
  { tier: 1, label: 'Building', min: 0, max: 29, color: MUTED, desc: 'New to BetterMate. Show up and your visibility grows.' },
  { tier: 2, label: 'Established', min: 30, max: 59, color: TEXT2, desc: 'You are active. Keep confirming plans to rise.' },
  { tier: 3, label: 'Trusted', min: 60, max: 79, color: GOLD, desc: 'Strong follow-through. You are seen by other trusted users.' },
  { tier: 4, label: 'Exemplary', min: 80, max: 100, color: SUCCESS, desc: 'Your integrity is your signal. You match with the best.' },
];

const REBUILD_ACTIONS = [
  { action: 'Send 3 qualifying messages', event: 'rebuild_messages', points: '+5' },
  { action: 'Confirm a 72-hour date plan', event: 'rebuild_plan', points: '+10' },
  { action: 'Complete a date check-in', event: 'rebuild_checkin', points: '+15' },
  { action: 'Rate a venue after your date', event: 'rebuild_venue_rating', points: '+5' },
  { action: 'Complete your fingerprint', event: 'rebuild_fingerprint', points: '+8' },
];

function getTier(score: number) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];
}

function scoreColor(score: number) {
  if (score >= 80) return SUCCESS;
  if (score >= 60) return GOLD;
  if (score >= 30) return TEXT2;
  return MUTED;
}

export default function IntegrityScore({ userId }: { userId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState<string | null>(null);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: existing } = await supabase
      .from('integrity_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      setData(existing);
    } else {
      // Seed new user with starter score
      const { data: created } = await supabase
        .from('integrity_scores')
        .insert({
          user_id: userId,
          score: 60,
          tier: 3,
          visibility_active: true,
          grace_period_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .select().single();
      setData(created);
      await trackEvent('integrity_visibility_tier_assigned', { tier: 3, score: 60 });
    }
    setLoading(false);
  }

  async function logRebuildAction(action: typeof REBUILD_ACTIONS[0]) {
    setRebuilding(action.event);
    const supabase = getSupabase();
    if (!supabase || !data) return;

    const delta = parseInt(action.points);
    const newScore = Math.min(100, data.score + delta);
    const newTier = getTier(newScore).tier;
    const now = new Date().toISOString();

    const { data: updated } = await supabase
      .from('integrity_scores')
      .update({
        score: newScore,
        tier: newTier,
        visibility_active: true,
        last_positive_action_at: now,
        degradation_reasons: [],
        updated_at: now,
      })
      .eq('user_id', userId)
      .select().single();

    setData(updated);
    await trackEvent('integrity_score_changed', { delta, reason_codes: [action.event] });
    if (!data.visibility_active) {
      await trackEvent('integrity_visibility_restored', { action_trigger: action.event });
    }
    setRebuilding(null);
  }

  if (loading) return null;
  if (!data) return null;

  const tier = getTier(data.score);
  const inGrace = data.grace_period_ends_at && new Date(data.grace_period_ends_at) > new Date();
  const visibilityPaused = !data.visibility_active;
  const hasDegradation = data.degradation_reasons?.length > 0;

  return (
    <div style={{ borderBottom: 'none' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) trackEvent('integrity_score_viewed', { score: data.score }); }}
        style={{ width: '100%', padding: '14px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>⬡</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Integrity Score</div>
            <div style={{ fontSize: 11, color: visibilityPaused ? WARNING : tier.color }}>
              {visibilityPaused ? 'Visibility paused — tap to rebuild' : tier.label + ' · ' + data.score + '/100'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid ' + scoreColor(data.score), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(data.score) }}>{data.score}</span>
          </div>
          <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: '20px' }}>

          {/* Core promise */}
          <div style={{ padding: '14px 16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>How it works</div>
            {[
              'Your Integrity Score improves your visibility on BetterMate.',
              'Higher integrity matches you with other high-integrity users.',
              'Safety cancellations never reduce your score.',
              'All changes are transparent and reversible through positive actions.',
            ].map((line, i) => (
              <div key={i} style={{ fontSize: 12, color: TEXT2, padding: '5px 0', borderBottom: i < 3 ? '1px solid ' + BORDER : 'none', lineHeight: 1.5 }}>
                · {line}
              </div>
            ))}
          </div>

          {/* Score ring + tier */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#2A1A45" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor(data.score)} strokeWidth="6"
                  strokeDasharray={`${(data.score / 100) * 214} 214`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(data.score), lineHeight: 1 }}>{data.score}</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: tier.color, fontFamily: 'Georgia, serif', marginBottom: 4 }}>{tier.label}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 8 }}>{tier.desc}</div>
              {inGrace && (
                <div style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(132,82,184,0.15)', border: '1px solid rgba(132,82,184,0.3)', borderRadius: 8, color: ACCENT, display: 'inline-block' }}>
                  Grace period active — new user
                </div>
              )}
            </div>
          </div>

          {/* Tier ladder */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Visibility tiers</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TIERS.slice().reverse().map((t) => {
                const isActive = t.tier === tier.tier;
                return (
                  <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent', borderRadius: 8, border: isActive ? '1px solid ' + t.color + '40' : '1px solid transparent' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? t.color : BORDER, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, color: isActive ? t.color : MUTED, fontWeight: isActive ? 600 : 400 }}>{t.label}</span>
                      <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>{t.min}–{t.max}</span>
                    </div>
                    {isActive && <span style={{ fontSize: 10, color: t.color }}>← you</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visibility paused notice */}
          {visibilityPaused && (
            <div style={{ padding: '14px 16px', background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.3)', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: WARNING, fontWeight: 600, marginBottom: 6 }}>Your visibility is paused</div>
              <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6, marginBottom: 12 }}>
                Take one action below to return. Your score and visibility rebuild through positive actions — never through punishment.
              </div>
              {hasDegradation && (
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
                  Signals: {data.degradation_reasons.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Rebuild actions */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: visibilityPaused ? WARNING : GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              {visibilityPaused ? 'Rebuild Integrity' : 'What helps your score'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REBUILD_ACTIONS.map((action) => (
                <div key={action.event} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: ELEVATED, borderRadius: 10, border: '1px solid ' + BORDER }}>
                  <span style={{ fontSize: 13, color: TEXT2 }}>{action.action}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: SUCCESS, fontWeight: 600 }}>{action.points}</span>
                    {visibilityPaused && (
                      <button
                        onClick={() => logRebuildAction(action)}
                        disabled={rebuilding === action.event}
                        style={{ padding: '4px 12px', background: BRAND, border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {rebuilding === action.event ? '...' : 'Do this'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transparency note */}
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
            Your score is based on behavior patterns — never on appearance, demographics, or message content. Safety cancellations are never penalized.
          </div>

        </div>
      )}
    </div>
  );
}
