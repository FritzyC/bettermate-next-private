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
const SUCCESS = '#4CAF7D';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';

type Reason = { text: string; signal: string };

export default function ExplainableMatch({
  matchId,
  userId,
  venueId,
  venueName,
  venueCategory,
  isMidpoint,
  isEventOverride,
  eventName,
}: {
  matchId: string;
  userId: string;
  venueId: string;
  venueName: string;
  venueCategory?: string;
  isMidpoint?: boolean;
  isEventOverride?: boolean;
  eventName?: string;
}) {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(false);

  useEffect(() => { generate(); }, [venueId, matchId]);

  async function generate() {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const [
      { data: fp },
      { data: matchData },
      { data: streak },
      { data: graph },
    ] = await Promise.all([
      supabase.from('user_fingerprint').select('*').eq('id', userId).single(),
      supabase.from('matches').select('*').eq('id', matchId).single(),
      supabase.from('show_up_streaks').select('*').eq('user_id', userId).single(),
      supabase.from('compatibility_graph').select('*').eq('match_id', matchId).single(),
    ]);

    const otherId = matchData?.user1_id === userId ? matchData?.user2_id : matchData?.user1_id;
    const { data: theirFP } = await supabase.from('user_fingerprint').select('*').eq('id', otherId).single();

    const { data: pastEvents } = await supabase
      .from('behavior_events')
      .select('event_type, payload')
      .eq('user_id', userId)
      .in('event_type', ['plan_confirmed', 'plan_checkin_confirmed', 'venue_rating_submitted'])
      .limit(20);

    const completedDates = (pastEvents || []).filter(e => e.event_type === 'plan_checkin_confirmed' && e.payload?.outcome === 'met').length;
    const sharedHobbies = (fp?.hobbies || []).filter((h: string) => (theirFP?.hobbies || []).includes(h));
    const sharedMusic = (fp?.music_genres || []).filter((g: string) => (theirFP?.music_genres || []).includes(g));
    const compatScore = graph?.compatibility_score;

    const prompt = `You are BetterMate's matching explainer. Your tone is warm, specific, evidence-based, and never uses manipulation or implies destiny. You explain why a specific venue fits two people based on real signals.

VENUE: "${venueName}" (${venueCategory || 'venue'})
IS MIDPOINT: ${isMidpoint ? 'yes — this is geographically fair for both users' : 'no'}
IS EVENT OVERRIDE: ${isEventOverride ? `yes — event: "${eventName}"` : 'no'}

USER SIGNALS:
- Hobbies: ${fp?.hobbies?.join(', ') || 'not provided'}
- Music: ${fp?.music_genres?.join(', ') || 'not provided'}
- Ideal Sunday: ${fp?.ideal_sunday || 'not provided'}
- Shared hobbies with match: ${sharedHobbies.join(', ') || 'none found'}
- Shared music with match: ${sharedMusic.join(', ') || 'none found'}
- Completed dates together: ${completedDates}
- Show up streak: ${streak?.current_streak || 0}
- Compatibility score: ${compatScore !== null ? compatScore + '/100' : 'not computed'}

Generate exactly 2–3 short reasons why this venue fits these two people.
Rules:
- Each reason must be <= 12 words
- Reference actual signals, never generic filler
- No manipulation, no destiny language
- If midpoint: include one reason about fairness
- If event override and shared interest: mention the shared interest
- Tone: warm, specific, honest

Respond with JSON only:
{"reasons": [{"text": "Short reason here", "signal": "fingerprint.hobbies|behavior.checkins|fairness.midpoint|event.override"}]}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      const r = parsed.reasons || [];
      setReasons(r);
      if (!shown) {
        await trackEvent('explainable_matching_shown', { venue_id: venueId, reasons: r.map((x: Reason) => x.text) }, matchId);
        setShown(true);
      }
    } catch (_) {
      const fallback: Reason[] = [];
      if (isMidpoint) fallback.push({ text: 'Roughly equal distance for both of you.', signal: 'fairness.midpoint' });
      if (sharedHobbies.length > 0) fallback.push({ text: `You both enjoy ${sharedHobbies[0]}.`, signal: 'fingerprint.hobbies' });
      if (isEventOverride && eventName) fallback.push({ text: `You both like this type of event.`, signal: 'event.override' });
      if (fallback.length === 0) fallback.push({ text: 'Fits your combined lifestyle signals.', signal: 'fingerprint.general' });
      setReasons(fallback);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: MUTED }}>◈ Reading signals...</span>
      </div>
    );
  }

  if (reasons.length === 0) return null;

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: '0.04em' }}>◈ Why this fits you</span>
        {reasons.length > 1 && (
          <button
            onClick={() => {
              setExpanded(!expanded);
              if (!expanded) trackEvent('explainable_matching_expanded', { venue_id: venueId }, matchId);
            }}
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 10, cursor: 'pointer' }}
          >
            {expanded ? 'Less ▲' : 'More ▼'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(expanded ? reasons : reasons.slice(0, 1)).map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ color: GOLD, fontSize: 10, marginTop: 2, flexShrink: 0 }}>·</span>
            <span style={{ fontSize: 12, color: TEXT2, lineHeight: 1.5 }}>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
