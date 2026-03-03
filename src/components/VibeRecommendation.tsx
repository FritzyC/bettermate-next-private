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

type Rec = { sectionId: string; icon: string; title: string; reason: string; };

async function getRecommendation(matchId: string, userId: string): Promise<Rec> {
  const supabase = getSupabase();
  if (!supabase) return fallback();
  const { data: plan } = await supabase.from('date_plans').select('*').eq('match_id', matchId).single();
  const { data: safety } = await supabase.from('safety_settings').select('id').eq('id', userId).single();

  if (!plan || plan.status === 'idle') {
    return { sectionId: 'date_plan', icon: '📅', title: 'Start your date plan', reason: 'No plan yet — 72 hours is all you need.' };
  }
  if (plan.status === 'voting' || plan.status === 'confirming_time') {
    return { sectionId: 'date_plan', icon: '📅', title: 'Finish your plan', reason: 'You started a plan — finish selecting the venue.' };
  }
  if (plan.status === 'plan_scheduled' && !safety) {
    return { sectionId: 'safety', icon: '🔒', title: 'Set up safety', reason: 'Date is confirmed. Add an emergency contact before you go.' };
  }
  if (plan.status === 'plan_scheduled') {
    return { sectionId: 'date_prep', icon: '🎁', title: 'Prep for your date', reason: 'Date is locked in — browse prep packs.' };
  }
  if (plan.status === 'completed_checked_in') {
    return { sectionId: 'date_plan', icon: '⭐', title: 'Rate the venue', reason: 'How was the spot? Your rating improves future suggestions.' };
  }
  return fallback();
}

function fallback(): Rec {
  return { sectionId: 'compat_graph', icon: '🧬', title: 'Check your compatibility', reason: 'See what signals point to alignment.' };
}

export default function VibeRecommendation({
  matchId,
  userId,
  onNavigate,
}: {
  matchId: string;
  userId: string;
  onNavigate: (sectionId: string) => void;
}) {
  const [rec, setRec] = useState<Rec | null>(null);

  useEffect(() => {
    getRecommendation(matchId, userId).then(r => {
      setRec(r);
      trackEvent('vibe_recommendation_shown', { recommended_tool: r.sectionId }, matchId);
    });
  }, [matchId, userId]);

  if (!rec) return null;

  return (
    <div style={{ padding: '14px 16px', background: 'rgba(201,169,110,0.07)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>
        Recommended next step
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{rec.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{rec.title}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{rec.reason}</div>
          </div>
        </div>
        <button
          onClick={() => {
            onNavigate(rec.sectionId);
            trackEvent('vibe_recommendation_tapped', { section: rec.sectionId }, matchId);
          }}
          style={{ padding: '8px 16px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          Open →
        </button>
      </div>
    </div>
  );
}
