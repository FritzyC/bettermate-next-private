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

type Insight = {
  title: string;
  body: string;
  type: 'pattern' | 'strength' | 'suggestion' | 'reflection';
  signal: string;
};

export default function CoachInsights({ matchId, userId }: { matchId: string; userId: string; inline?: boolean }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); }, [userId, matchId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from('coach_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('match_id', matchId)
      .single();
    if (data) {
      setInsights(data.insights || []);
      setGeneratedAt(data.generated_at);
    }
    setLoading(false);
  }

  async function generate() {
    setGenerating(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const [
      { data: fp },
      { data: streak },
      { data: events },
      { data: plan },
      { data: match },
    ] = await Promise.all([
      supabase.from('user_fingerprint').select('*').eq('id', userId).single(),
      supabase.from('show_up_streaks').select('*').eq('user_id', userId).single(),
      supabase.from('behavior_events').select('event_type, payload, created_at')
        .eq('user_id', userId).eq('match_id', matchId)
        .order('created_at', { ascending: false }).limit(40),
      supabase.from('date_plans').select('*').eq('match_id', matchId).single(),
      supabase.from('matches').select('user1_id, user2_id').eq('id', matchId).single(),
    ]);

    const otherId = match?.user1_id === userId ? match?.user2_id : match?.user1_id;
    const { data: theirFP } = await supabase.from('user_fingerprint').select('*').eq('id', otherId).single();
    const { data: graph } = await supabase.from('compatibility_graph').select('*').eq('match_id', matchId).single();

    const eventSummary = (events || []).map((e: any) => e.event_type).join(', ');
    const planStatus = plan?.status || 'none';
    const streakNum = streak?.current_streak || 0;
    const totalConfirmed = streak?.total_confirmed || 0;
    const compatScore = graph?.compatibility_score || null;

    const prompt = `You are BetterMate's connection coach. Your tone is warm, specific, honest, and non-judgmental — like a thoughtful therapist who also understands human behavior. Never shame. Never pressure. Always transparent about what signals you are reading.

You are generating insights for one user about their connection with a specific match.

USER DATA:
- Hobbies: ${fp?.hobbies?.join(', ') || 'not provided'}
- Music: ${fp?.music_genres?.join(', ') || 'not provided'}
- Narrative themes: ${fp?.narrative_themes?.join(', ') || 'not provided'}
- About self: ${fp?.about_self || 'not provided'}
- Ideal Sunday: ${fp?.ideal_sunday || 'not provided'}

MATCH DATA:
- Their hobbies: ${theirFP?.hobbies?.join(', ') || 'not provided'}
- Their music: ${theirFP?.music_genres?.join(', ') || 'not provided'}

BEHAVIOR SIGNALS:
- Events in this match: ${eventSummary || 'none yet'}
- Date plan status: ${planStatus}
- Show up streak: ${streakNum} (total confirmed: ${totalConfirmed})
- Compatibility score: ${compatScore !== null ? compatScore + '/100' : 'not yet computed'}

Generate exactly 3 insights. Each must be:
- Specific to this user and this match (not generic)
- Grounded in the signals above (name the signal you are reading)
- Warm, honest, non-judgmental
- Actionable or reflective — never prescriptive

Types to use: "pattern", "strength", "suggestion", "reflection"

Respond with JSON only:
{
  "insights": [
    {
      "title": "Short title (4-6 words)",
      "body": "2-3 sentences. Warm, specific, transparent. Reference the actual signal.",
      "type": "pattern",
      "signal": "behavior.event_name or fingerprint.field"
    }
  ]
}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      const newInsights = parsed.insights || [];
      const now = new Date().toISOString();

      await supabase.from('coach_insights').upsert({
        user_id: userId,
        match_id: matchId,
        insights: newInsights,
        generated_at: now,
      });

      setInsights(newInsights);
      setGeneratedAt(now);
      await trackEvent('coach_insights_generated', { count: newInsights.length }, matchId);
    } catch (_) {
      setInsights([{
        title: 'Keep building your story',
        body: 'Complete your fingerprint and confirm your first date to unlock personalized insights. The more you show up, the more specific and useful these become.',
        type: 'suggestion',
        signal: 'graph.insufficient_data',
      }]);
    }
    setGenerating(false);
  }

  function typeColor(t: string) {
    if (t === 'strength') return SUCCESS;
    if (t === 'pattern') return GOLD;
    if (t === 'suggestion') return ACCENT;
    return TEXT2;
  }

  function typeLabel(t: string) {
    if (t === 'strength') return 'Strength';
    if (t === 'pattern') return 'Pattern';
    if (t === 'suggestion') return 'Suggestion';
    return 'Reflection';
  }

  function typeEmoji(t: string) {
    if (t === 'strength') return '✦';
    if (t === 'pattern') return '◈';
    if (t === 'suggestion') return '→';
    return '○';
  }

  const daysAgo = generatedAt
    ? Math.floor((Date.now() - new Date(generatedAt).getTime()) / 86400000)
    : null;

  if (loading) return null;

  return (
    <div style={{ borderBottom: 'none' }}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) {
            trackEvent('coach_insights_viewed', {}, matchId);
            if (!insights.length) generate();
          }
        }}
        style={{
          width: '100%', padding: '14px 20px',
          background: open ? SURFACE : 'transparent',
          border: 'none', borderTop: '1px solid ' + BORDER,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Coach Insights</div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {insights.length > 0
                ? insights.length + ' insights' + (daysAgo === 0 ? ' · updated today' : daysAgo === 1 ? ' · updated yesterday' : daysAgo !== null ? ' · ' + daysAgo + 'd ago' : '')
                : 'Tap to generate your insights'}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: '20px' }}>

          {generating && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🧠</div>
              <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>Reading your signals...</p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: MUTED }}>
                Analyzing your fingerprint, behavior patterns, and compatibility data
              </p>
            </div>
          )}

          {!generating && insights.length > 0 && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {insights.map((insight, i) => (
                  <div key={i} style={{
                    padding: '16px', background: ELEVATED,
                    borderRadius: 14, border: '1px solid ' + BORDER,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, color: typeColor(insight.type) }}>{typeEmoji(insight.type)}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{insight.title}</span>
                      </div>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 10,
                        background: typeColor(insight.type) + '20',
                        color: typeColor(insight.type),
                        border: '1px solid ' + typeColor(insight.type) + '40',
                      }}>
                        {typeLabel(insight.type)}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: TEXT2, lineHeight: 1.7 }}>
                      {insight.body}
                    </p>
                    <div style={{ fontSize: 10, color: MUTED }}>
                      Signal: {insight.signal}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: MUTED }}>
                  {daysAgo === 0 ? 'Generated today' : daysAgo === 1 ? 'Generated yesterday' : 'Generated ' + daysAgo + ' days ago'}
                </span>
                <button onClick={generate} disabled={generating}
                  style={{
                    padding: '6px 14px', background: 'transparent',
                    border: '1px solid ' + BORDER, borderRadius: 8,
                    color: MUTED, fontSize: 11, cursor: 'pointer',
                  }}>
                  ↻ Refresh
                </button>
              </div>

              <div style={{
                padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
                borderRadius: 10, fontSize: 11, color: MUTED, lineHeight: 1.6,
              }}>
                These insights are based on your declared preferences and behavioral patterns — never your messages. They improve as you confirm more dates and complete your fingerprint.
              </div>
            </div>
          )}

          {!generating && insights.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
              <p style={{ margin: '0 0 6px', fontSize: 14, color: TEXT }}>No insights yet</p>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                Complete your fingerprint and start a date plan to unlock personalized coaching.
              </p>
              <button onClick={generate}
                style={{
                  padding: '12px 24px', background: BRAND,
                  border: 'none', borderRadius: 12,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                Generate My Insights
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
