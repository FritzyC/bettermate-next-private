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
const ACCENT = '#8452B8';

type Factor = {
  label: string;
  insight: string;
  signal: string;
  strength: 'strong' | 'moderate' | 'developing';
};

type GraphData = {
  compatibility_score: number;
  explanation_factors: Factor[];
  signals: Record<string, any>;
  computed_at: string;
};

export default function CompatibilityGraph({ matchId, userId, inline = false }: { matchId: string; userId: string; inline?: boolean }) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); }, [matchId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from('compatibility_graph')
      .select('*')
      .eq('match_id', matchId)
      .single();
    if (data) setGraph(data);
    setLoading(false);
  }

  async function compute() {
    setComputing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: match } = await supabase.from('matches').select('user1_id, user2_id').eq('id', matchId).single();
    if (!match) { setComputing(false); return; }

    const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;

    const [
      { data: myFP }, { data: theirFP },
      { data: myProfile }, { data: theirProfile },
      { data: myEvents }, { data: theirEvents },
      { data: myPacts }, { data: plans },
    ] = await Promise.all([
      supabase.from('user_fingerprint').select('*').eq('id', userId).single(),
      supabase.from('user_fingerprint').select('*').eq('id', otherId).single(),
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('user_profiles').select('*').eq('id', otherId).single(),
      supabase.from('behavior_events').select('event_type, created_at').eq('user_id', userId).eq('match_id', matchId).order('created_at', { ascending: false }).limit(50),
      supabase.from('behavior_events').select('event_type, created_at').eq('user_id', otherId).eq('match_id', matchId).order('created_at', { ascending: false }).limit(50),
      supabase.from('date_pacts').select('*').eq('match_id', matchId).single(),
      supabase.from('date_plans').select('*').eq('match_id', matchId).single(),
    ]);

    // Compute signals
    const myCheckin = (myEvents || []).some((e: any) => e.event_type === 'plan_checkin_confirmed');
    const theirCheckin = (theirEvents || []).some((e: any) => e.event_type === 'plan_checkin_confirmed');
    const dateCompleted = plans?.status === 'completed_checked_in';
    const pactActive = myPacts?.status === 'active' || myPacts?.status === 'settled_success';
    const bondProposed = (myEvents || []).some((e: any) => e.event_type === 'bond_proposed') ||
                         (theirEvents || []).some((e: any) => e.event_type === 'bond_proposed');

    // Fingerprint overlap
    const sharedHobbies = (myFP?.hobbies || []).filter((h: string) => (theirFP?.hobbies || []).includes(h));
    const sharedMusic = (myFP?.music_genres || []).filter((g: string) => (theirFP?.music_genres || []).includes(g));
    const sharedNarrative = (myFP?.narrative_themes || []).filter((t: string) => (theirFP?.narrative_themes || []).includes(t));
    const vibeMatch = myFP?.music_vibe === theirFP?.music_vibe;
    const kidsAlign = (myFP?.kids_preference || []).some((k: string) => (theirFP?.kids_preference || []).includes(k));
    const smokingAlign = myFP?.smoking === theirFP?.smoking;

    // Values alignment
    const trajDiff = Math.abs((myProfile?.life_trajectory_score || 3) - (theirProfile?.life_trajectory_score || 3));
    const conflictDiff = Math.abs((myProfile?.conflict_style_score || 3) - (theirProfile?.conflict_style_score || 3));
    const financeDiff = Math.abs((myProfile?.finance_alignment_score || 3) - (theirProfile?.finance_alignment_score || 3));
    const growthDiff = Math.abs((myProfile?.growth_orientation_score || 3) - (theirProfile?.growth_orientation_score || 3));
    const readinessSum = (myProfile?.readiness_score || 3) + (theirProfile?.readiness_score || 3);

    // Score computation
    let score = 50;
    score += Math.min(sharedHobbies.length * 5, 15);
    score += Math.min(sharedMusic.length * 3, 10);
    score += sharedNarrative.length * 2;
    score += vibeMatch ? 5 : 0;
    score += kidsAlign ? 8 : -5;
    score += smokingAlign ? 5 : 0;
    score -= trajDiff * 3;
    score -= conflictDiff * 4;
    score -= financeDiff * 3;
    score += growthDiff < 2 ? 5 : 0;
    score += readinessSum >= 8 ? 8 : readinessSum >= 6 ? 4 : 0;
    score += dateCompleted ? 10 : 0;
    score += pactActive ? 5 : 0;
    score += bondProposed ? 3 : 0;
    score = Math.max(20, Math.min(99, score));

    // Build explanation factors
    const factors: Factor[] = [];

    if (sharedHobbies.length >= 2) {
      factors.push({
        label: 'Shared Energy',
        insight: 'You both show up for ' + sharedHobbies.slice(0, 2).join(' and ') + '. Plans built around shared activity have the highest follow-through.',
        signal: 'fingerprint.hobbies_overlap',
        strength: sharedHobbies.length >= 3 ? 'strong' : 'moderate',
      });
    }

    if (trajDiff <= 1 && conflictDiff <= 1) {
      factors.push({
        label: 'Values Alignment',
        insight: 'Your life direction and conflict styles are closely matched. This reduces friction in the early stages of connection.',
        signal: 'profile.values_delta',
        strength: trajDiff === 0 && conflictDiff === 0 ? 'strong' : 'moderate',
      });
    }

    if (vibeMatch || sharedMusic.length >= 2) {
      factors.push({
        label: 'Emotional Frequency',
        insight: 'You share a music vibe' + (sharedMusic.length >= 2 ? ' and ' + sharedMusic.length + ' genres' : '') + '. People with similar emotional pacing tend to feel more at ease together.',
        signal: 'fingerprint.music_overlap',
        strength: vibeMatch && sharedMusic.length >= 2 ? 'strong' : 'moderate',
      });
    }

    if (dateCompleted) {
      factors.push({
        label: 'Proven Follow-Through',
        insight: 'You both confirmed a real-world meetup. This is the single strongest predictor of continued connection on BetterMate.',
        signal: 'behavior.checkin_completed',
        strength: 'strong',
      });
    }

    if (kidsAlign && smokingAlign) {
      factors.push({
        label: 'Lifestyle Compatibility',
        insight: 'Your lifestyle preferences are aligned on key long-term factors. These rarely change and matter more over time.',
        signal: 'fingerprint.lifestyle_overlap',
        strength: 'strong',
      });
    }

    if (readinessSum >= 8) {
      factors.push({
        label: 'Mutual Readiness',
        insight: 'Both of you indicated high readiness for connection. This reduces the gap between intention and action.',
        signal: 'profile.readiness_sum',
        strength: readinessSum >= 9 ? 'strong' : 'moderate',
      });
    }

    if (factors.length === 0) {
      factors.push({
        label: 'Early Stage',
        insight: 'Your compatibility graph is still developing. Complete your fingerprint and go on your first date to unlock deeper insights.',
        signal: 'graph.insufficient_data',
        strength: 'developing',
      });
    }

    const signals = {
      shared_hobbies: sharedHobbies,
      shared_music: sharedMusic,
      shared_narrative: sharedNarrative,
      vibe_match: vibeMatch,
      kids_align: kidsAlign,
      smoking_align: smokingAlign,
      date_completed: dateCompleted,
      bond_proposed: bondProposed,
      pact_active: pactActive,
      values_delta: { traj: trajDiff, conflict: conflictDiff, finance: financeDiff, growth: growthDiff },
    };

    const graphData = {
      user_a_id: userId,
      user_b_id: otherId,
      match_id: matchId,
      compatibility_score: score,
      explanation_factors: factors,
      signals,
      computed_at: new Date().toISOString(),
    };

    await supabase.from('compatibility_graph').upsert(graphData);
    setGraph(graphData as GraphData);
    await trackEvent('compat_graph_computed', { score }, matchId);
    setComputing(false);
  }

  function strengthColor(s: string) {
    if (s === 'strong') return SUCCESS;
    if (s === 'moderate') return GOLD;
    return MUTED;
  }

  function strengthLabel(s: string) {
    if (s === 'strong') return 'Strong signal';
    if (s === 'moderate') return 'Moderate signal';
    return 'Developing';
  }

  function scoreColor(s: number) {
    if (s >= 80) return SUCCESS;
    if (s >= 60) return GOLD;
    if (s >= 40) return ACCENT;
    return MUTED;
  }

  function scoreLabel(s: number) {
    if (s >= 85) return 'Exceptional Alignment';
    if (s >= 70) return 'Strong Compatibility';
    if (s >= 55) return 'Promising Match';
    if (s >= 40) return 'Early Potential';
    return 'Still Discovering';
  }

  if (loading) return null;

  return (
    <div style={{ borderBottom: inline ? 'none' : '1px solid ' + BORDER }}>
      <button onClick={() => {
        setOpen(!open);
        if (!open && graph) trackEvent('compat_explanation_viewed', { score: graph.compatibility_score }, matchId);
        if (!open && !graph) compute();
      }}
        style={{ width: '100%', padding: '13px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🧬</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Compatibility Graph</div>
            <div style={{ fontSize: 11, color: graph ? scoreColor(graph.compatibility_score) : MUTED }}>
              {graph ? graph.compatibility_score + ' — ' + scoreLabel(graph.compatibility_score) : 'Tap to compute your graph'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {graph && (
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid ' + scoreColor(graph.compatibility_score), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(graph.compatibility_score) }}>{graph.compatibility_score}</span>
            </div>
          )}
          <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: '20px' }}>

          {computing && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🧬</div>
              <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>Reading your signals...</p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: MUTED }}>Analyzing fingerprints, values, and behavior patterns</p>
            </div>
          )}

          {!computing && graph && (
            <div>
              {/* Score ring */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER }}>
                <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                  <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#2A1A45" strokeWidth="6" />
                    <circle cx="36" cy="36" r="30" fill="none" stroke={scoreColor(graph.compatibility_score)} strokeWidth="6"
                      strokeDasharray={`${(graph.compatibility_score / 100) * 188} 188`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor(graph.compatibility_score), lineHeight: 1 }}>{graph.compatibility_score}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: scoreColor(graph.compatibility_score), fontFamily: 'Georgia, serif', marginBottom: 4 }}>
                    {scoreLabel(graph.compatibility_score)}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                    Based on {graph.explanation_factors.length} signal{graph.explanation_factors.length !== 1 ? 's' : ''} from your fingerprints, values, and behavior patterns.
                  </div>
                  <div style={{ fontSize: 10, color: '#3D2860', marginTop: 6 }}>
                    Last computed {new Date(graph.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Explanation factors */}
              <p style={{ margin: '0 0 12px', fontSize: 11, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Why You Two</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {graph.explanation_factors.map((factor, i) => (
                  <div key={i} style={{ padding: '14px 16px', background: ELEVATED, borderRadius: 12, border: '1px solid ' + BORDER }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{factor.label}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: strengthColor(factor.strength) + '20', color: strengthColor(factor.strength), border: '1px solid ' + strengthColor(factor.strength) + '40' }}>
                        {strengthLabel(factor.strength)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>{factor.insight}</p>
                  </div>
                ))}
              </div>

              {/* Signals summary */}
              {graph.signals.shared_hobbies?.length > 0 && (
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Shared Interests</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[...graph.signals.shared_hobbies, ...graph.signals.shared_music.slice(0, 2)].map((item: string, i: number) => (
                      <span key={i} style={{ padding: '4px 10px', background: 'rgba(132,82,184,0.15)', border: '1px solid rgba(132,82,184,0.3)', borderRadius: 20, fontSize: 12, color: TEXT2 }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Transparency note */}
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                This graph uses declared preferences and behavioral patterns — never location, messages, or private data. It improves as you interact and complete plans together.
              </div>

              {/* Recompute */}
              <button onClick={compute} disabled={computing}
                style={{ width: '100%', marginTop: 14, padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
                ↻ Recompute graph
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
