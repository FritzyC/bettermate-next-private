'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';

type Dimension = {
  id: string; label: string; icon: string; score: number;
  headline: string; detail: string; color: string;
};
type SnapshotData = {
  overallScore: number; grade: string; summary: string; dimensions: Dimension[];
};

const DIMENSION_META = [
  { id: 'trajectory_score', label: 'Life Trajectory', icon: '◈', color: '#c084fc',
    headlines: ['Different directions', 'Some overlap', 'Aligned paths', 'Strong alignment', 'Rare sync'],
    details: ['You are heading in different directions right now. Worth exploring openly.',
      'Some overlap in where you are headed. Worth discussing what matters most.',
      'You both prioritize building something meaningful. That shared drive reduces friction.',
      'Strong alignment on life direction. This creates natural momentum together.',
      'Rare alignment. You are both locked into compatible visions of the future.'] },
  { id: 'conflict_score', label: 'Conflict Style', icon: '◉', color: '#f0abca',
    headlines: ['Different approaches', 'Some compatibility', 'Compatible styles', 'Strong compatibility', 'Natural fit'],
    details: ['You handle conflict very differently. Awareness here will prevent most issues.',
      'Some differences in conflict style. Naming this early helps.',
      'When friction shows up, you both tend to address it constructively.',
      'Strong compatibility under pressure. Repair will come naturally.',
      'Your conflict styles are a natural fit. Tension will resolve quickly.'] },
  { id: 'finance_score', label: 'Finance Alignment', icon: '◎', color: '#a78bfa',
    headlines: ['Different relationships', 'Some tension possible', 'Compatible views', 'Strong alignment', 'Rare match'],
    details: ['You relate to money differently. This is worth an honest conversation early.',
      'Some differences in how you see money. Not a dealbreaker with communication.',
      'You share a similar relationship with money. That reduces long-term friction.',
      'Strong finance alignment. You will make financial decisions without major conflict.',
      'Rare alignment. You are both on the same page about money without needing to negotiate it.'] },
  { id: 'growth_score', label: 'Growth Orientation', icon: '◐', color: '#f9a8c9',
    headlines: ['Different paces', 'Some mismatch', 'Balanced orientation', 'Strong alignment', 'Both builders'],
    details: ['You are at different points in your growth orientation. One may feel held back.',
      'Some difference in how much each of you wants to push forward.',
      'You balance stability and growth similarly. Neither will feel dragged.',
      'Strong growth alignment. You will push each other forward naturally.',
      'You are both builders. Forward motion is a shared value.'] },
];

function getLevel(diff: number): number {
  if (diff <= 0.5) return 4;
  if (diff <= 1) return 3;
  if (diff <= 2) return 2;
  if (diff <= 3) return 1;
  return 0;
}

function ScoreRing({ score, size = 130 }: { score: number; size?: number }) {
  const [animated, setAnimated] = useState(0);
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ - (animated / 100) * circ;
  useEffect(() => { const t = setTimeout(() => setAnimated(score), 150); return () => clearTimeout(t); }, [score]);
  const color = score >= 85 ? '#c084fc' : score >= 70 ? '#a78bfa' : '#f0abca';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1a2e" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }} />
    </svg>
  );
}

function PipScore({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%',
          background: i < score ? color : '#2a2040',
          transition: 'background 0.3s ease ' + (i * 80) + 'ms' }} />
      ))}
    </div>
  );
}

export default function CompatibilitySnapshot({ matchId }: { matchId: string }) {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get match to find both user IDs
      const { data: match } = await supabase
        .from('matches')
        .select('user_a_id, user_b_id')
        .eq('id', matchId)
        .single();

      if (!match) { setError('Match not found'); return; }

      const otherUserId = match.user_a_id === session.user.id ? match.user_b_id : match.user_a_id;

      // Get both profiles
      const { data: myProfile } = await supabase
        .from('user_profiles')
        .select('trajectory_score, conflict_score, finance_score, growth_score')
        .eq('id', session.user.id)
        .single();

      const { data: theirProfile } = await supabase
        .from('user_profiles')
        .select('trajectory_score, conflict_score, finance_score, growth_score')
        .eq('id', otherUserId)
        .single();

      // Fall back to mock if profiles not complete
      const myScores = myProfile || { trajectory_score: 3, conflict_score: 3, finance_score: 3, growth_score: 3 };
      const theirScores = theirProfile || { trajectory_score: 4, conflict_score: 4, finance_score: 4, growth_score: 4 };

      const dimensions: Dimension[] = DIMENSION_META.map((meta) => {
        const myVal = (myScores as any)[meta.id] ?? 3;
        const theirVal = (theirScores as any)[meta.id] ?? 3;
        const diff = Math.abs(myVal - theirVal);
        const level = getLevel(diff);
        const pipScore = 5 - diff;
        return {
          id: meta.id,
          label: meta.label,
          icon: meta.icon,
          color: meta.color,
          score: Math.max(1, Math.round(pipScore)),
          headline: meta.headlines[level],
          detail: meta.details[level],
        };
      });

      const avg = dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length;
      const overallScore = Math.round((avg / 5) * 100);
      const grade = overallScore >= 85 ? 'Exceptional' : overallScore >= 70 ? 'Strong' : overallScore >= 55 ? 'Promising' : 'Developing';
      const summary = overallScore >= 85
        ? 'Rare alignment across what actually matters. This deserves your full attention.'
        : overallScore >= 70 ? 'Solid foundation with real shared values. The friction that exists will make you both better.'
        : overallScore >= 55 ? 'Real potential here. The differences are not dealbreakers - they are data.'
        : 'Still early. Consistency over time will tell the real story.';

      setData({ overallScore, grade, summary, dimensions });
      trackEvent('snapshot_viewed', { overallScore, grade }, matchId);
    }
    load();
  }, [matchId]);

  if (error) return null;

  if (!data) return (
    <div style={{ padding: '32px 24px', color: '#6b5b8a', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c084fc' }} />
      <span style={{ fontSize: 14 }}>Reading your connection...</span>
    </div>
  );

  const topColor = data.overallScore >= 70 ? '#c084fc' : '#f0abca';

  return (
    <div style={{ background: 'linear-gradient(160deg,#0e0a1a 0%,#150d24 100%)', border: '1px solid #2a1f45', borderRadius: 20, padding: '28px 24px', fontFamily: 'Georgia, serif', color: '#fff', marginBottom: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: '0 0 4px', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4a3a6a', fontFamily: 'system-ui' }}>Why This Works</p>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 400, color: '#e8d8f8', letterSpacing: '-0.02em' }}>Compatibility Snapshot</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, background: 'rgba(192,132,252,0.06)', borderRadius: 16, padding: '20px 22px', marginBottom: 24, border: '1px solid rgba(192,132,252,0.12)' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ScoreRing score={data.overallScore} size={130} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{ fontSize: 30, fontWeight: 300, color: '#e8d8f8', letterSpacing: '-0.03em', lineHeight: 1 }}>{data.overallScore}</span>
            <span style={{ fontSize: 13, color: '#4a3a6a' }}>%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: topColor, marginBottom: 8 }}>{data.grade} Match</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#7a6a9a' }}>{data.summary}</p>
        </div>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2e2248', fontFamily: 'system-ui' }}>Dimension Breakdown</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {data.dimensions.map((d) => (
          <button key={d.id} onClick={() => { const opening = expanded !== d.id; setExpanded(opening ? d.id : null); if (opening) trackEvent('snapshot_expanded', { dimension: d.id, score: d.score }, matchId); }}
            style={{ background: expanded === d.id ? 'rgba(192,132,252,0.05)' : '#0e0a1a', border: '1px solid ' + (expanded === d.id ? d.color + '33' : '#1e1634'), borderRadius: 14, padding: '15px 17px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ fontSize: 18, color: d.color }}>{d.icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: '#b8a8d8', marginBottom: 6, fontFamily: 'system-ui' }}>{d.label}</div>
                  <PipScore score={d.score} color={d.color} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: d.color, fontFamily: 'system-ui' }}>{d.score}/5</span>
                <span style={{ fontSize: 11, color: '#3a2e5a', fontFamily: 'system-ui' }}>{expanded === d.id ? '↑' : '↓'}</span>
              </div>
            </div>
            {expanded === d.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #2a1f45' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: d.color, marginBottom: 8, fontFamily: 'system-ui' }}>{d.headline}</div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#6a5a8a', fontFamily: 'system-ui' }}>{d.detail}</p>
              </div>
            )}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 10, color: '#2e2248', textAlign: 'center', letterSpacing: '0.04em', lineHeight: 1.5, fontFamily: 'system-ui' }}>
        Scores reflect behavioral patterns, not fixed types. They evolve as you interact.
      </p>
    </div>
  );
}
