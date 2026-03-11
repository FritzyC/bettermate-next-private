'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import CompatibilityGraph from '@/components/CompatibilityGraph';
import KineticMatchmaker from '@/components/KineticMatchmaker';
import CommitmentBond from '@/components/CommitmentBond';
import DatePlan from '@/components/DatePlan';
import SafetyLayer from '@/components/SafetyLayer';
import TrustedDatePrep from '@/components/TrustedDatePrep';
import ShowUpStreak from '@/components/ShowUpStreak';
import CoachInsights from '@/components/CoachInsights';
import IntegrityScore from '@/components/IntegrityScore';
import VibeRecommendation from '@/components/VibeRecommendation';
import ActivityGraph from '@/components/ActivityGraph';
import MicroGroup from '@/components/MicroGroup';
import RecurringRituals from '@/components/RecurringRituals';

const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const GOLD = '#C9A96E';
const BG = '#1E1035';

async function logEvent(event: string, payload: Record<string, any> = {}, matchId?: string) {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('behavior_events').insert({
      user_id: session.user.id,
      match_id: matchId ?? null,
      event_type: event,
      payload,
    });
  } catch (_) {}
}

const SECTIONS = [
  { id: 'compat_graph', icon: '🧬', title: 'Compatibility Graph', desc: 'Scored signals + why you two' },
  { id: 'matchmaker', icon: '🧭', title: 'Kinetic Matchmaker', desc: 'AI first date + conversation plan' },
  { id: 'commitment_bond', icon: '💎', title: 'Commitment Bond', desc: 'Propose to focus on each other' },
  { id: 'date_plan', icon: '📅', title: '72-Hour Date Commitment', desc: 'AI venue suggestions + voting' },
  { id: 'safety', icon: '🔒', title: 'Safety Setup', desc: 'Emergency contact + check-in timer' },
  { id: 'date_prep', icon: '🎁', title: 'Trusted Date Prep', desc: 'Credit packs for date quality' },
  { id: 'streak', icon: '🔥', title: 'Show Up Streak', desc: 'Your consistency, your identity' },
  { id: 'coach', icon: '🧠', title: 'Coach Insights', desc: 'What your patterns say about you' },
  { id: 'integrity', icon: '⬡', title: 'Integrity Score', desc: 'Your visibility and trust signal' },
  { id: 'activity', icon: '🎯', title: 'Activity Graph', desc: 'Plan-first discovery' },
  { id: 'groups', icon: '👥', title: 'Micro-Groups', desc: 'Plan with 2–6 people' },
  { id: 'rituals', icon: '🔁', title: 'Recurring Rituals', desc: 'Weekly social anchors' },
];

export default function VibeDrawer({
  open,
  onClose,
  matchId,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  matchId: string;
  userId: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function navigateTo(sectionId: string) {
    setExpanded(sectionId);
    logEvent('vibe_section_opened', { section: sectionId }, matchId);
    setTimeout(() => {
      const el = document.getElementById('vibe-section-' + sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) logEvent('vibe_opened', { source: 'toolbar' }, matchId);
    else logEvent('vibe_closed', {}, matchId);
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setExpanded(null);
  }, [open]);

  function toggleSection(id: string) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) logEvent('vibe_section_opened', { section: id }, matchId);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(8,4,26,0.7)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Vibe tools"
        style={{
          position: 'fixed',
          right: 0, top: 0, bottom: 0,
          width: 'min(420px, 100vw)',
          background: BG,
          borderLeft: '1px solid ' + BORDER,
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid ' + BORDER,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 400, color: TEXT, fontFamily: 'Georgia, serif', letterSpacing: '-0.01em' }}>Vibe</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Tools to move from intention to action</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Vibe drawer"
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Accordion list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0 24px' }}>
          <div style={{ padding: '12px 16px 4px' }}>
            <VibeRecommendation matchId={matchId} userId={userId} onNavigate={navigateTo} />
          </div>
          {SECTIONS.map((section) => {
            const isOpen = expanded === section.id;
            return (
              <div key={section.id} style={{ borderBottom: '1px solid ' + BORDER }}>
                <button
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  aria-controls={'vibe-section-' + section.id}
                  style={{
                    width: '100%', padding: '14px 20px',
                    background: isOpen ? SURFACE : 'transparent',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{section.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{section.title}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{section.desc}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, color: MUTED,
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}>▼</span>
                </button>

                {isOpen && (
                  <div
                    id={'vibe-section-' + section.id}
                    style={{ background: SURFACE }}
                  >
                    {section.id === 'compat_graph' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <CompatibilityGraph matchId={matchId} userId={userId} inline />
                      </div>
                    )}
                    {section.id === 'matchmaker' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <KineticMatchmaker matchId={matchId} userId={userId} inline />
                      </div>
                    )}
                    {section.id === 'commitment_bond' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <CommitmentBond matchId={matchId} userId={userId} planStatus={null} scheduledAt={null} />
                      </div>
                    )}
                    {section.id === 'date_plan' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <DatePlan matchId={matchId} userId={userId} inline />
                      </div>
                    )}
                    {section.id === 'safety' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <SafetyLayer matchId={matchId} userId={userId} inline />
                      </div>
                    )}
                    {section.id === 'activity' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <ActivityGraph userId={userId} />
                      </div>
                    )}
                    {section.id === 'groups' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <MicroGroup userId={userId} />
                      </div>
                    )}
                    {section.id === 'rituals' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <RecurringRituals userId={userId} />
                      </div>
                    )}
                    {section.id === 'integrity' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <IntegrityScore userId={userId} />
                      </div>
                    )}
                    {section.id === 'coach' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <CoachInsights matchId={matchId} userId={userId} />
                      </div>
                    )}
                    {section.id === 'streak' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <ShowUpStreak userId={userId} />
                      </div>
                    )}
                    {section.id === 'date_prep' && (
                      <div style={{ padding: '0 0 4px' }}>
                        <TrustedDatePrep matchId={matchId} userId={userId} inline />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
