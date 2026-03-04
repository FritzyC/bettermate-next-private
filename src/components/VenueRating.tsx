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

const TAGS = [
  { id: 'safe', label: '🛡️ Safe' },
  { id: 'romantic', label: '🌹 Romantic' },
  { id: 'good_for_talking', label: '💬 Great for talking' },
  { id: 'great_music', label: '🎵 Great music' },
  { id: 'loud', label: '🔊 Loud' },
  { id: 'crowded', label: '👥 Crowded' },
  { id: 'overpriced', label: '💸 Overpriced' },
];

const STAR_LABELS = ['', 'Not great', 'It was ok', 'Pretty good', 'Really good', 'Amazing'];

export default function VenueRating({
  matchId,
  userId,
  venueId,
  venueName,
  onDone,
}: {
  matchId: string;
  userId: string;
  venueId: string;
  venueName: string;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  useEffect(() => {
    checkAlreadyRated();
    trackEvent('venue_rating_prompt_shown', { venue_id: venueId }, matchId);
  }, []);

  async function checkAlreadyRated() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from('venue_ratings')
      .select('id')
      .eq('user_id', userId)
      .eq('match_id', matchId)
      .eq('venue_id', venueId)
      .single();
    if (data) setAlreadyRated(true);
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  async function submit() {
    if (rating === 0) return;
    setSubmitting(true);
    const supabase = getSupabase();
    if (!supabase) return;

    // Save rating
    await supabase.from('venue_ratings').insert({
      user_id: userId,
      match_id: matchId,
      venue_id: venueId,
      venue_name: venueName,
      rating,
      tags: selectedTags,
    });

    // Update aggregate quality score
    const { data: existing } = await supabase
      .from('venue_quality_scores')
      .select('*')
      .eq('venue_id', venueId)
      .single();

    if (existing) {
      const newCount = existing.rating_count + 1;
      const newAvg = ((existing.avg_rating * existing.rating_count) + rating) / newCount;
      const tagCounts = { ...(existing.tags || {}) };
      selectedTags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
      await supabase.from('venue_quality_scores').update({
        avg_rating: Math.round(newAvg * 10) / 10,
        rating_count: newCount,
        tags: tagCounts,
        updated_at: new Date().toISOString(),
      }).eq('venue_id', venueId);
    } else {
      const tagCounts: Record<string, number> = {};
      selectedTags.forEach(t => { tagCounts[t] = 1; });
      await supabase.from('venue_quality_scores').insert({
        venue_id: venueId,
        venue_name: venueName,
        avg_rating: rating,
        rating_count: 1,
        tags: tagCounts,
      });
    }

    await trackEvent('venue_rating_submitted', {
      venue_id: venueId,
      rating,
      tags: selectedTags,
    }, matchId);

    setDone(true);
    setSubmitting(false);
    onDone?.();
  }

  if (alreadyRated || done) {
    return (
      <div style={{ padding: '16px', background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', borderRadius: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>⭐</div>
        <div style={{ fontSize: 13, color: SUCCESS, fontWeight: 600 }}>Rating saved</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Your feedback improves future suggestions.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>
          Rate the venue
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{venueName}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
          Your rating improves future date suggestions for everyone.
        </div>
      </div>

      {/* Stars */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 32,
              opacity: star <= (hovered || rating) ? 1 : 0.3,
              transform: star <= (hovered || rating) ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.15s ease',
            }}
          >
            ⭐
          </button>
        ))}
      </div>

      {/* Star label */}
      <div style={{ textAlign: 'center', fontSize: 13, color: GOLD, fontWeight: 600, marginBottom: 16, minHeight: 20 }}>
        {STAR_LABELS[hovered || rating] || ''}
      </div>

      {/* Tags */}
      {rating > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>What stood out? (optional)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TAGS.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                style={{
                  padding: '6px 12px',
                  background: selectedTags.includes(tag.id) ? 'rgba(201,169,110,0.15)' : SURFACE,
                  border: '1px solid ' + (selectedTags.includes(tag.id) ? GOLD : BORDER),
                  borderRadius: 20,
                  color: selectedTags.includes(tag.id) ? GOLD : MUTED,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={submit}
        disabled={rating === 0 || submitting}
        style={{
          width: '100%', padding: '12px',
          background: rating > 0 ? BRAND : SURFACE,
          border: 'none', borderRadius: 10,
          color: rating > 0 ? '#fff' : MUTED,
          fontSize: 13, fontWeight: 600,
          cursor: rating > 0 ? 'pointer' : 'not-allowed',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Saving...' : 'Submit Rating'}
      </button>

      <p style={{ margin: '10px 0 0', fontSize: 11, color: MUTED, textAlign: 'center', lineHeight: 1.5 }}>
        Ratings are aggregated and never tied to your identity.
      </p>
    </div>
  );
}
