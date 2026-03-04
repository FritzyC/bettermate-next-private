'use client';
import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';
import { buildFairnessPrompt } from '@/lib/geofairness';
import { getPreferences, getTopPreferences } from '@/components/PreferenceLearning';

const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const GOLD = '#C9A96E';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const SUCCESS = '#4CAF7D';

const INTENT_MODES = [
  { id: 'dating', label: '💞 Dating', desc: 'Romantic connection' },
  { id: 'friends', label: '🤝 Friends', desc: 'Low-pressure hangout' },
  { id: 'networking', label: '💼 Networking', desc: 'Professional meet' },
];

const TIME_WINDOWS = [
  { id: 'tonight', label: '🌙 Tonight' },
  { id: 'this_week', label: '📅 This week' },
  { id: 'weekend', label: '☀️ Weekend' },
];

const TRAVEL_MODES = [
  { id: 'car', label: '🚗 Drive' },
  { id: 'transit', label: '🚌 Transit' },
  { id: 'walk', label: '🚶 Walk' },
];

export default function ActivityGraph({ userId }: { userId: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [intent, setIntent] = useState<string>('dating');
  const [timeWindow, setTimeWindow] = useState<string>('this_week');
  const [travelMode, setTravelMode] = useState<string>('car');
  const [location, setLocation] = useState('');
  const [step, setStep] = useState<'pick' | 'configure' | 'results'>('pick');
  const [venues, setVenues] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { loadActivities(); }, []);

  async function loadActivities() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.from('activities').select('*');
    setActivities(data || []);
  }

  async function generateSuggestions() {
    if (!location.trim() || !selected) return;
    setGenerating(true);
    trackEvent('activity_selected', { activity_id: selected, intent_mode: intent });

    try {
      const supabase = getSupabase();
      if (!supabase) return;

      const prefs = await getPreferences(userId);
      const preferredTags = prefs ? getTopPreferences(prefs, 3) : [];
      const { data: fp } = await supabase.from('user_fingerprint').select('hobbies,music').eq('user_id', userId).single();
      const activity = activities.find(a => a.id === selected);

      const prompt = `${buildFairnessPrompt(location, location, travelMode as any, fp, null, preferredTags)}

Activity focus: ${activity?.label} (${activity?.description})
Intent: ${intent}
Time window: ${timeWindow}

Tailor venue suggestions to this specific activity and intent. Return the same JSON format.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setVenues(parsed);

      // Save to activity_suggestions
      await supabase.from('activity_suggestions').insert({
        user_id: userId,
        activity_id: selected,
        intent_mode: intent,
        time_window: timeWindow,
        travel_mode: travelMode,
        location_hint: location,
        venues: parsed,
      });

      await trackEvent('activity_suggestions_shown', { count_venues: parsed.length });
      setStep('results');
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); trackEvent('activity_opened', { user_id: userId }); }}
        style={{ width: '100%', padding: '14px 20px', background: 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Activity Graph</div>
            <div style={{ fontSize: 11, color: MUTED }}>Plan-first discovery — find who fits this activity</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>▼</span>
      </button>
    );
  }

  return (
    <div style={{ background: SURFACE, borderTop: '1px solid ' + BORDER }}>
      <button onClick={() => setOpen(false)}
        style={{ width: '100%', padding: '14px 20px', background: ELEVATED, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>Activity Graph</div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>▲</span>
      </button>

      <div style={{ padding: '16px 20px' }}>
        {step === 'pick' && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: MUTED }}>What do you want to do?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {activities.map(a => (
                <button key={a.id} onClick={() => setSelected(a.id)}
                  style={{ padding: '8px 14px', background: selected === a.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (selected === a.id ? GOLD : BORDER), borderRadius: 20, color: selected === a.id ? GOLD : TEXT2, fontSize: 12, cursor: 'pointer', fontWeight: selected === a.id ? 600 : 400 }}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
            <button onClick={() => selected && setStep('configure')} disabled={!selected}
              style={{ width: '100%', padding: '11px', background: selected ? BRAND : ELEVATED, border: 'none', borderRadius: 10, color: selected ? '#fff' : MUTED, fontSize: 13, fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed' }}>
              Next →
            </button>
          </div>
        )}

        {step === 'configure' && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Intent</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {INTENT_MODES.map(m => (
                  <button key={m.id} onClick={() => setIntent(m.id)}
                    style={{ flex: 1, padding: '8px 4px', background: intent === m.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (intent === m.id ? GOLD : BORDER), borderRadius: 8, color: intent === m.id ? GOLD : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>When</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIME_WINDOWS.map(t => (
                  <button key={t.id} onClick={() => setTimeWindow(t.id)}
                    style={{ flex: 1, padding: '8px 4px', background: timeWindow === t.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (timeWindow === t.id ? GOLD : BORDER), borderRadius: 8, color: timeWindow === t.id ? GOLD : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>How you travel</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {TRAVEL_MODES.map(t => (
                  <button key={t.id} onClick={() => setTravelMode(t.id)}
                    style={{ flex: 1, padding: '8px 4px', background: travelMode === t.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (travelMode === t.id ? GOLD : BORDER), borderRadius: 8, color: travelMode === t.id ? GOLD : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your area (zip or neighborhood)</p>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Brooklyn NY or 10001"
                style={{ width: '100%', padding: '10px 12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('pick')}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
                Back
              </button>
              <button onClick={generateSuggestions} disabled={!location.trim() || generating}
                style={{ flex: 2, padding: '10px', background: location.trim() ? BRAND : ELEVATED, border: 'none', borderRadius: 10, color: location.trim() ? '#fff' : MUTED, fontSize: 13, fontWeight: 600, cursor: location.trim() ? 'pointer' : 'not-allowed' }}>
                {generating ? '🔍 Finding venues...' : 'Find venues →'}
              </button>
            </div>
          </div>
        )}

        {step === 'results' && venues.length > 0 && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: GOLD, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {activities.find(a => a.id === selected)?.icon} {activities.find(a => a.id === selected)?.label} venues for you
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {venues.map((v: any, i: number) => (
                <div key={i} style={{ padding: '12px 14px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 12 }}>
                  {v.special_event && (
                    <div style={{ fontSize: 10, color: '#8452B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>✨ Featured</div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{v.address}</div>
                  <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.5, marginBottom: 6 }}>✨ {v.why}</div>
                  {v.fairness && (
                    <div style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.2)', borderRadius: 10, color: SUCCESS, display: 'inline-block' }}>
                      ⚖️ {v.fairness.label}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setStep('pick'); setSelected(null); setVenues([]); setLocation(''); }}
              style={{ marginTop: 14, width: '100%', padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
              Start over
            </button>
          </div>
        )}

        <p style={{ margin: '12px 0 0', fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
          Activity Graph uses your learned preferences — never your message history.
        </p>
      </div>
    </div>
  );
}
