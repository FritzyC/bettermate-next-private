'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

const BG = '#1E1035';
const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const GOLD = '#C9A96E';
const GOLD2 = '#E2C488';

type Suggestion = {
  date_suggestion: string;
  conversation_pace: string;
  first_topics: string;
};

export default function KineticMatchmaker({ matchId, userId, inline = false }: { matchId: string; userId: string; inline?: boolean }) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); }, [matchId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from('kinetic_suggestions')
      .select('date_suggestion, conversation_pace, first_topics')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .single();
    if (data) { setSuggestion(data); setLoading(false); return; }
    setLoading(false);
  }

  async function generate() {
    setGenerating(true);
    const supabase = getSupabase();
    if (!supabase) return;

    // Fetch both users' data
    const { data: match } = await supabase.from('matches').select('user1_id, user2_id').eq('id', matchId).single();
    if (!match) { setGenerating(false); return; }

    const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;

    const [{ data: myFP }, { data: theirFP }, { data: myProfile }, { data: theirProfile }] = await Promise.all([
      supabase.from('user_fingerprint').select('*').eq('id', userId).single(),
      supabase.from('user_fingerprint').select('*').eq('id', otherId).single(),
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('user_profiles').select('*').eq('id', otherId).single(),
    ]);

    const prompt = `You are the Kinetic Matchmaker — a warm, insightful relationship AI. Based on two people's profiles, generate a personalized connection plan.

PERSON A:
- Values scores: Life Trajectory ${myProfile?.life_trajectory_score}/5, Conflict Style ${myProfile?.conflict_style_score}/5, Finance ${myProfile?.finance_alignment_score}/5, Growth ${myProfile?.growth_orientation_score}/5, Readiness ${myProfile?.readiness_score}/5
- Music genres: ${myFP?.music_genres?.join(', ')}
- Music vibe: ${myFP?.music_vibe}
- Narrative themes: ${myFP?.narrative_themes?.join(', ')}
- Hobbies: ${myFP?.hobbies?.join(', ')}
- Field: ${myFP?.field}
- Kids: ${myFP?.kids_preference?.join(', ')}
- Smoking: ${myFP?.smoking}
- About self: ${myFP?.about_self || 'not provided'}
- Ideal Sunday: ${myFP?.ideal_sunday || 'not provided'}
- Love language: ${myFP?.love_language || 'not provided'}
- Movie lines: ${myFP?.favorite_movie_lines || 'not provided'}

PERSON B:
- Values scores: Life Trajectory ${theirProfile?.life_trajectory_score}/5, Conflict Style ${theirProfile?.conflict_style_score}/5, Finance ${theirProfile?.finance_alignment_score}/5, Growth ${theirProfile?.growth_orientation_score}/5, Readiness ${theirProfile?.readiness_score}/5
- Music genres: ${theirFP?.music_genres?.join(', ')}
- Music vibe: ${theirFP?.music_vibe}
- Narrative themes: ${theirFP?.narrative_themes?.join(', ')}
- Hobbies: ${theirFP?.hobbies?.join(', ')}
- Field: ${theirFP?.field}
- Kids: ${theirFP?.kids_preference?.join(', ')}
- Smoking: ${theirFP?.smoking}
- About self: ${theirFP?.about_self || 'not provided'}
- Ideal Sunday: ${theirFP?.ideal_sunday || 'not provided'}
- Love language: ${theirFP?.love_language || 'not provided'}
- Movie lines: ${theirFP?.favorite_movie_lines || 'not provided'}

Generate a JSON response with exactly these 3 fields:
{
  "date_suggestion": "A specific, vivid first date idea (2-3 sentences). Reference their actual shared interests. Make it feel designed for them, not generic.",
  "conversation_pace": "Advice on how fast or slow to move emotionally in this specific pairing (2-3 sentences). Reference their readiness and conflict scores.",
  "first_topics": "3-4 specific conversation threads that would create real connection for THIS pairing, based on their actual profiles. Be specific and warm."
}

Respond with JSON only. No preamble.`;

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
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      await supabase.from('kinetic_suggestions').upsert({
        match_id: matchId,
        user_id: userId,
        date_suggestion: parsed.date_suggestion,
        conversation_pace: parsed.conversation_pace,
        first_topics: parsed.first_topics,
        generated_at: new Date().toISOString(),
      });

      setSuggestion(parsed);
      setOpen(true);
    } catch (_) {}
    setGenerating(false);
  }

  if (loading) return null;

  return (
    <div style={{ margin: '0 0 0', borderBottom: '1px solid ' + BORDER }}>

      {/* Trigger button */}
      <button onClick={() => suggestion ? setOpen(!open) : generate()}
        style={{ width: '100%', padding: '13px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🧭</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>Kinetic Matchmaker</div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {generating ? 'Reading your profiles...' : suggestion ? 'Your personalized connection plan' : 'Generate your first date + conversation plan'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 16, color: GOLD }}>
          {generating ? '⏳' : open ? '▲' : '▼'}
        </div>
      </button>

      {/* Content */}
      {open && suggestion && (
        <div style={{ padding: '20px', background: SURFACE, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Date suggestion */}
          <div style={{ padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📍</span>
              <span style={{ fontSize: 11, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>First Date</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.7 }}>{suggestion.date_suggestion}</p>
          </div>

          {/* Conversation pace */}
          <div style={{ padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>🌊</span>
              <span style={{ fontSize: 11, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Your Pace</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.7 }}>{suggestion.conversation_pace}</p>
          </div>

          {/* First topics */}
          <div style={{ padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ fontSize: 11, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>What to Talk About</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.7 }}>{suggestion.first_topics}</p>
          </div>

          <button onClick={() => { setSuggestion(null); generate(); }}
            style={{ padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
            ↻ Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
