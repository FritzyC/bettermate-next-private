// Geospatial Fairness 2.0 — travel-time fairness engine
// Privacy-first: never expose exact coordinates; show time buckets only

export type TravelMode = 'car' | 'transit' | 'walk';

export type FairnessScore = {
  bucket: 'balanced' | 'slight_a' | 'slight_b' | 'event_override';
  label: string;
  explanation: string;
};

export type FairnessVenue = {
  id: string;
  name: string;
  address: string;
  why: string;
  midpoint_note: string;
  type: string;
  category: string;
  special_event?: boolean;
  event_note?: string;
  fairness: FairnessScore;
  travel_time_a_bucket: string;
  travel_time_b_bucket: string;
};

export function buildFairnessPrompt(
  locationA: string,
  locationB: string,
  travelMode: TravelMode,
  fingerprintA: any,
  fingerprintB: any,
  preferredTags: string[] = []
): string {
  const modeLabel = travelMode === 'car' ? 'driving' : travelMode === 'transit' ? 'public transit' : 'walking';
  const tagHint = preferredTags.length > 0 ? `\nLearned preferences: user tends to enjoy ${preferredTags.join(', ')}.` : '';

  return `You are BetterMate's Geospatial Fairness Engine. Suggest exactly 3 real public venues for a date.

User A is near: ${locationA}
User B is near: ${locationB}
Travel mode: ${modeLabel}
${tagHint}

User A interests: ${JSON.stringify(fingerprintA?.hobbies || [])}
User B interests: ${JSON.stringify(fingerprintB?.hobbies || [])}
Shared music taste: ${JSON.stringify([...(fingerprintA?.music || []), ...(fingerprintB?.music || [])])}

FAIRNESS RULES (strict):
1. Try to keep estimated travel time difference <= 10 minutes between users.
2. One venue should favor User A's area, one User B's area, one midpoint.
3. If a special event (comedy, concert, theater) aligns with both users' interests, you may add it as a "featured" option and mark special_event: true.
4. Reject venues in non-reachable areas (highway medians, industrial zones, private property).
5. All venues must be public, safe, well-lit, appropriate for a first meeting.
6. Never reveal exact user coordinates in output.

TRAVEL TIME BUCKETS (use these exact strings):
- "~5–15 min" / "~15–25 min" / "~25–35 min" / "~35–45 min" / "45+ min"

FAIRNESS SCORE BUCKETS:
- "balanced" = travel time difference <= 10 min
- "slight_a" = slightly closer to User A (still fair)
- "slight_b" = slightly closer to User B (still fair)
- "event_override" = special event venue, wider radius justified by shared interest

Respond with JSON only — array of exactly 3 venues (or 4 if event override):
[
  {
    "id": "unique_slug",
    "name": "Real Venue Name",
    "address": "Full address",
    "type": "cafe|bar|park|museum|theater|restaurant|other",
    "category": "casual|entertainment|culture|outdoor|social",
    "why": "1 sentence tied to their actual shared interests (max 12 words)",
    "midpoint_note": "Balanced travel time for both of you." or "Slightly closer to you; higher venue quality.",
    "special_event": false,
    "event_note": null,
    "fairness": {
      "bucket": "balanced",
      "label": "Fair for both",
      "explanation": "Balanced travel time for both of you."
    },
    "travel_time_a_bucket": "~15–25 min",
    "travel_time_b_bucket": "~15–25 min",
    "suggested_times": ["Saturday 2pm", "Sunday 3pm", "Friday 7pm"]
  }
]`;
}

export function getFairnessColor(bucket: FairnessScore['bucket']): string {
  switch (bucket) {
    case 'balanced': return '#4CAF7D';
    case 'slight_a': return '#C9A96E';
    case 'slight_b': return '#C9A96E';
    case 'event_override': return '#8452B8';
    default: return '#7A6A96';
  }
}

export function getFairnessIcon(bucket: FairnessScore['bucket']): string {
  switch (bucket) {
    case 'balanced': return '⚖️';
    case 'slight_a': return '↗️';
    case 'slight_b': return '↗️';
    case 'event_override': return '✨';
    default: return '📍';
  }
}
