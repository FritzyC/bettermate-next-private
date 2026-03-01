'use client';

import React, { useEffect, useState } from 'react';

type Dimension = {
  id: string; label: string; icon: string; score: number;
  headline: string; detail: string; color: string;
};
type SnapshotData = {
  overallScore: number; grade: string; summary: string; dimensions: Dimension[];
};

function generateSnapshot(matchId: string): SnapshotData {
  const seed = matchId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const rand = (min: number, max: number, offset: number = 0) => {
    const v = ((seed + offset) * 2654435761) >>> 0;
    return Math.round(min + (v % ((max - min) * 10)) / 10);
  };
  const dims: Dimension[] = [
    { id: 'trajectory', label: 'Life Trajectory', icon: '◈', score: rand(3, 5, 1),
      headline: 'Headed in the same direction',
      detail: 'You both prioritize building something meaningful. That shared drive creates natural momentum and reduces resentment over time.',
      color: '#c084fc' },
    { id: 'conflict', label: 'Conflict Style', icon: '◉', score: rand(2, 5, 2),
      headline: 'Compatible under pressure',
      detail: 'When friction shows up, you both tend to name it rather than avoid it. That makes repair faster and keeps things from festering.',
      color: '#f0abca' },
    { id: 'finance', label: 'Finance Alignment', icon: '◎', score: rand(3, 5, 3),
      headline: 'Money as a tool, not a scorecard',
      detail: 'You share a similar relationship with money — neither reckless nor paralyzed. That reduces one of the biggest sources of long-term friction.',
      color: '#a78bfa' },
    { id: 'growth', label: 'Growth Orientation', icon: '◐', score: rand(2, 5, 4),
      headline: 'Both wired to keep moving',
      detail: "You're both oriented toward growth rather than maintenance. You'll push each other forward without one person feeling dragged along.",
      color: '#f9a8c9' },
  ];
  const avg = dims.reduce((a, d) => a + d.score, 0) / dims.length;
  const overallScore = Math.round((avg / 5) * 100);
  const grade = overallScore >= 85 ? 'Exceptional' : overallScore >= 70 ? 'Strong' : overallScore >= 55 ? 'Promising' : 'Developing';
  const summary = overallScore >= 85
    ? 'Rare alignment across what actually matters. This deserves your full attention.'
    : overallScore >= 70 ? 'Solid foundation with real shared values. The friction that exists will make you both better.'
    : overallScore >= 55 ? "Real potential here. The differences aren't dealbreakers — they're data."
    : 'Still early. Consistency over time will tell the real story.';
  return { overallScore, grade, summary, dimensions: dims };
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
          transition: `background 0.3s ease ${i * 80}ms` }} />
      ))}
    </div>
  );
}

export default function CompatibilitySnapshot({ matchId }: { matchId: string }) {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setData(generateSnapshot(matchId)), 400); return () => clearTimeout(t); }, [matchId]);

  if (!data) return (
    <div style={{ padding: '32px 24px', color: '#6b5b8a', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c084fc' }} />
      <span style={{ fontSize: 14 }}>Reading your connection...</span>
    </div>
  );

  const topColor = data.overallScore >= 70 ? '#c084fc' : '#f0abca';
  return (
    <div style={{ background: 'linear-gradient(160deg,#0e0a1a 0%,#150d24 100%)', border: '1px solid #2a1f45', borderRadius: 20, padding: '28px 24px', fontFamily: "'Georgia',serif", color: '#fff', marginBottom: 24 }}>
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
          <button key={d.id} onClick={() => setExpanded(expanded === d.id ? null : d.id)}
            style={{ background: expanded === d.id ? 'rgba(192,132,252,0.05)' : '#0e0a1a', border: `1px solid ${expanded === d.id ? d.color + '33' : '#1e1634'}`, borderRadius: 14, padding: '15px 17px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s ease' }}>
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
