'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';

const QUESTIONS = [
  {
    id: 'trajectory_score',
    label: 'Life Trajectory',
    question: 'Where are you headed in the next 3 years?',
    options: [
      { score: 1, text: 'Still figuring it out - open to anything' },
      { score: 2, text: 'I have a rough direction but staying flexible' },
      { score: 3, text: 'Clear goals, actively working toward them' },
      { score: 4, text: 'Building something specific - focused and deliberate' },
      { score: 5, text: 'Locked in - I know exactly where I am going' },
    ],
  },
  {
    id: 'conflict_score',
    label: 'Conflict Style',
    question: 'When something upsets you, what do you usually do first?',
    options: [
      { score: 1, text: 'Go quiet and process alone - I need space' },
      { score: 2, text: 'Vent to someone I trust before addressing it' },
      { score: 3, text: 'Try to understand the other side first' },
      { score: 4, text: 'Name it directly - I would rather be uncomfortable than unclear' },
      { score: 5, text: 'Address it immediately - tension bothers me more than conflict' },
    ],
  },
  {
    id: 'finance_score',
    label: 'Finance Alignment',
    question: 'How do you relate to money?',
    options: [
      { score: 1, text: 'It stresses me out - I avoid thinking about it' },
      { score: 2, text: 'Security blanket - I need a cushion to feel safe' },
      { score: 3, text: 'A tool - I use it intentionally but do not obsess' },
      { score: 4, text: 'Freedom - I want enough to live without constraints' },
      { score: 5, text: 'Scorecard - I track it closely and think about it often' },
    ],
  },
  {
    id: 'growth_score',
    label: 'Growth Orientation',
    question: 'Would you rather build something new or perfect something existing?',
    options: [
      { score: 1, text: 'Perfect what exists - consistency matters more to me' },
      { score: 2, text: 'Mostly maintain, with occasional new challenges' },
      { score: 3, text: 'Balance - I need both stability and new experiences' },
      { score: 4, text: 'Lean toward new - growth energizes me' },
      { score: 5, text: 'Always building - I get restless without forward motion' },
    ],
  },
  {
    id: 'readiness_score',
    label: 'Readiness',
    question: 'What are you actually ready for right now?',
    options: [
      { score: 1, text: 'Casual - exploring without expectations' },
      { score: 2, text: 'Open - willing to see where things go' },
      { score: 3, text: 'Intentional - I want something real but I am patient' },
      { score: 4, text: 'Ready - I know what I want and I am showing up for it' },
      { score: 5, text: 'All in - I am here to build something that lasts' },
    ],
  },
];

export default function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const progress = (step / QUESTIONS.length) * 100;

  async function handleNext() {
    if (selected === null) return;
    const next = { ...answers, [q.id]: selected };
    setAnswers(next);

    if (!isLast) {
      setSelected(null);
      setStep(step + 1);
      return;
    }

    setSaving(true);
    const supabase = getSupabase();
    if (!supabase) { router.replace('/auth'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/auth'); return; }

    await supabase.from('user_profiles').upsert({
      id: session.user.id,
      ...next,
      onboarding_done: true,
    });

    await trackEvent('onboarding_completed', { scores: next });
    router.replace('/onboarding/fingerprint');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a0514 0%, #130a20 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'system-ui',
      color: '#fff',
    }}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 13, letterSpacing: '0.2em', color: '#4a3a6a', textTransform: 'uppercase', marginBottom: 4 }}>
          BetterMate
        </div>
        <div style={{ fontSize: 11, color: '#2e2248', letterSpacing: '0.1em' }}>
          Intention meets action
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 520, marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#4a3a6a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {q.label}
          </span>
          <span style={{ fontSize: 11, color: '#2e2248' }}>
            {step + 1} of {QUESTIONS.length}
          </span>
        </div>
        <div style={{ height: 2, background: '#1e1634', borderRadius: 2 }}>
          <div style={{
            height: '100%',
            width: progress + '%',
            background: 'linear-gradient(90deg, #a78bfa, #f0abca)',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 520, marginBottom: 32 }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 400,
          color: '#e8d8f8',
          lineHeight: 1.4,
          margin: '0 0 32px',
          letterSpacing: '-0.02em',
          fontFamily: 'Georgia, serif',
        }}>
          {q.question}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((opt) => (
            <button
              key={opt.score}
              onClick={() => setSelected(opt.score)}
              style={{
                padding: '16px 20px',
                background: selected === opt.score ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                border: '1px solid ' + (selected === opt.score ? '#a78bfa' : '#1e1634'),
                borderRadius: 12,
                color: selected === opt.score ? '#e8d8f8' : '#7a6a9a',
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'system-ui',
              }}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 520 }}>
        <button
          onClick={handleNext}
          disabled={selected === null || saving}
          style={{
            width: '100%',
            padding: '16px',
            background: selected !== null ? 'linear-gradient(135deg, #a78bfa, #f0abca)' : '#1e1634',
            color: selected !== null ? '#fff' : '#3a2e5a',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: selected !== null ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            letterSpacing: '0.02em',
          }}
        >
          {saving ? 'Saving...' : isLast ? 'See My Matches' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
