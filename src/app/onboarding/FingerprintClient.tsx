'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';

const MUSIC_GENRES = ['Jazz','Rock','Hip-Hop','Classical','Electronic','R&B','Indie','Pop','Folk','Metal','Blues','Country','Christian'];
const MUSIC_VIBES = ['High Energy / Expressive','Balanced / Social','Calm / Reflective'];
const NARRATIVE_THEMES = ['Coming-of-Age','Thriller','Romance','Sci-Fi','Drama','Comedy','Documentary','Action','Horror','Fantasy','Mystery'];
const HOBBIES = ['Hiking','Dancing','Yoga','Rock Climbing','Running','Cycling','Photography','Cooking','Painting','Gaming','Reading','Traveling'];
const KIDS_OPTIONS = ['Want Kids','Have Kids','Open to Kids','Do Not Want Kids'];
const SMOKING_OPTIONS = ['No','Yes (Tobacco)','Occasionally','Marijuana Only'];

const BG = '#1E1035';
const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const ACCENT = '#8452B8';

function MultiSelect({ options, selected, onToggle, max }: { options: string[]; selected: string[]; onToggle: (v: string) => void; max?: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        const disabled = !active && max !== undefined && selected.length >= max;
        return (
          <button key={opt} onClick={() => !disabled && onToggle(opt)}
            style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid ' + (active ? ACCENT : BORDER), background: active ? 'rgba(132,82,184,0.2)' : ELEVATED, color: active ? TEXT : (disabled ? MUTED : TEXT2), fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'all 0.15s' }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SingleSelect({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onSelect(opt)}
          style={{ padding: '13px 18px', borderRadius: 12, border: '1px solid ' + (selected === opt ? ACCENT : BORDER), background: selected === opt ? 'rgba(132,82,184,0.2)' : ELEVATED, color: selected === opt ? TEXT : TEXT2, fontSize: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: value ? 'rgba(123,28,74,0.2)' : ELEVATED, border: '1px solid ' + (value ? '#7B1C4A' : BORDER), borderRadius: 10, cursor: 'pointer', width: '100%' }}>
      <div style={{ width: 20, height: 20, borderRadius: 4, background: value ? '#7B1C4A' : 'transparent', border: '2px solid ' + (value ? '#7B1C4A' : BORDER), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {value && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 13, color: TEXT2 }}>{label}</span>
    </button>
  );
}

const STEPS = [
  { id: 'music', title: 'Music Taste', subtitle: 'Music reveals your emotional pacing and social energy.' },
  { id: 'stories', title: 'Movies & Stories', subtitle: 'Stories reveal values, conflict style, and emotional depth.' },
  { id: 'career', title: 'Education & Career', subtitle: 'Context helps us understand your world.' },
  { id: 'hobbies', title: 'Active Hobbies', subtitle: 'Activities help us design first dates that feel effortless.' },
  { id: 'lifestyle', title: 'Lifestyle', subtitle: 'Honest answers help us protect your time.' },
];

export default function FingerprintClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [musicGenres, setMusicGenres] = useState<string[]>([]);
  const [musicVibe, setMusicVibe] = useState('');
  const [narrativeThemes, setNarrativeThemes] = useState<string[]>([]);
  const [school, setSchool] = useState('');
  const [field, setField] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [kidsPreference, setKidsPreference] = useState<string[]>([]);
  const [kidsDealbreaker, setKidsDealbreaker] = useState(false);
  const [smoking, setSmoking] = useState('');
  const [smokingDealbreaker, setSmokingDealbreaker] = useState(false);

  const current = STEPS[step];
  const progress = (step / STEPS.length) * 100;

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  function canContinue() {
    if (current.id === 'music') return musicGenres.length >= 2 && musicVibe !== '';
    if (current.id === 'stories') return narrativeThemes.length >= 2;
    if (current.id === 'career') return true;
    if (current.id === 'hobbies') return hobbies.length >= 2;
    if (current.id === 'lifestyle') return kidsPreference.length > 0 && smoking !== '';
    return false;
  }

  async function handleNext() {
    if (!canContinue()) return;
    if (step < STEPS.length - 1) { setStep(step + 1); return; }

    setSaving(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/auth'); return; }

    await supabase.from('user_fingerprint').upsert({
      id: session.user.id,
      music_genres: musicGenres,
      music_vibe: musicVibe,
      narrative_themes: narrativeThemes,
      school: school || null,
      field: field || null,
      hobbies,
      kids_preference: kidsPreference,
      kids_dealbreaker: kidsDealbreaker,
      smoking,
      smoking_dealbreaker: smokingDealbreaker,
      updated_at: new Date().toISOString(),
    });

    await trackEvent('onboarding_completed', { stage: 'fingerprint' });
    router.replace('/matches');
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui', color: TEXT }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>BetterMate</div>
          <div style={{ fontSize: 11, color: '#3D2860', letterSpacing: '0.1em' }}>Cultural Fingerprint</div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{current.title}</span>
            <span style={{ fontSize: 11, color: MUTED }}>{step + 1} of {STEPS.length}</span>
          </div>
          <div style={{ height: 2, background: '#2A1A45', borderRadius: 2 }}>
            <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg, #6B3FA0, #C9A96E)', borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Question */}
        <h2 style={{ fontSize: 22, fontWeight: 400, color: TEXT, lineHeight: 1.4, margin: '0 0 8px', fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>{current.title}</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 28px', lineHeight: 1.6 }}>{current.subtitle}</p>

        {/* Step content */}
        {current.id === 'music' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Favorite Genres (select at least 2)</p>
              <MultiSelect options={MUSIC_GENRES} selected={musicGenres} onToggle={v => toggleArr(musicGenres, setMusicGenres, v)} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Your Vibe</p>
              <SingleSelect options={MUSIC_VIBES} selected={musicVibe} onSelect={setMusicVibe} />
            </div>
          </div>
        )}

        {current.id === 'stories' && (
          <div>
            <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Narrative Themes (select at least 2)</p>
            <MultiSelect options={NARRATIVE_THEMES} selected={narrativeThemes} onToggle={v => toggleArr(narrativeThemes, setNarrativeThemes, v)} />
          </div>
        )}

        {current.id === 'career' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>School / University (optional)</p>
              <input value={school} onChange={e => setSchool(e.target.value)} placeholder="Where did you study?"
                style={{ width: '100%', padding: '13px 16px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 12, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Field / Industry</p>
              <input value={field} onChange={e => setField(e.target.value)} placeholder="What do you do?"
                style={{ width: '100%', padding: '13px 16px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 12, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}

        {current.id === 'hobbies' && (
          <div>
            <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Select at least 2</p>
            <MultiSelect options={HOBBIES} selected={hobbies} onToggle={v => toggleArr(hobbies, setHobbies, v)} />
          </div>
        )}

        {current.id === 'lifestyle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Kids Preference</p>
              <MultiSelect options={KIDS_OPTIONS} selected={kidsPreference} onToggle={v => toggleArr(kidsPreference, setKidsPreference, v)} />
              <div style={{ marginTop: 12 }}>
                <Toggle label="This is a dealbreaker for me" value={kidsDealbreaker} onChange={setKidsDealbreaker} />
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Smoking</p>
              <SingleSelect options={SMOKING_OPTIONS} selected={smoking} onSelect={setSmoking} />
              <div style={{ marginTop: 12 }}>
                <Toggle label="This is a dealbreaker for me" value={smokingDealbreaker} onChange={setSmokingDealbreaker} />
              </div>
            </div>
          </div>
        )}

        {/* Continue button */}
        <div style={{ marginTop: 36 }}>
          <button onClick={handleNext} disabled={!canContinue() || saving}
            style={{ width: '100%', padding: '15px', background: canContinue() ? BRAND : ELEVATED, border: 'none', borderRadius: 12, color: canContinue() ? '#fff' : MUTED, fontSize: 15, fontWeight: 600, cursor: canContinue() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {saving ? 'Saving...' : step < STEPS.length - 1 ? 'Continue' : 'Activate My Fingerprint'}
          </button>
        </div>

        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{ width: '100%', marginTop: 12, padding: '12px', background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer' }}>
            Back
          </button>
        )}
      </div>
    </div>
  );
}
