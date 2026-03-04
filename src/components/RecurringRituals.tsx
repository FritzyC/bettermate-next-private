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

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const TIMES = [{ id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Evening' }];

export default function RecurringRituals({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [rituals, setRituals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [step, setStep] = useState<'list' | 'create'>('list');
  const [form, setForm] = useState({ name: '', activity_id: '', preferred_day: 'Saturday', preferred_time_window: 'evening' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from('rituals').select('*').eq('user_id', userId).eq('active', true),
      supabase.from('activities').select('*'),
    ]);
    setRituals(r || []);
    setActivities(a || []);
  }

  async function saveRitual() {
    if (!form.activity_id) return;
    setSaving(true);
    const supabase = getSupabase();
    if (!supabase) { setSaving(false); return; }
    const activity = activities.find((a: any) => a.id === form.activity_id);
    const name = form.name.trim() || (activity?.label + ' ' + form.preferred_day);
    const { data } = await supabase.from('rituals').insert({
      user_id: userId, activity_id: form.activity_id, name,
      preferred_day: form.preferred_day, preferred_time_window: form.preferred_time_window,
      next_pack_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).select().single();
    if (data) {
      await trackEvent('ritual_enabled', { ritual_id: data.id, activity_id: form.activity_id, cadence: 'weekly' });
      load(); setStep('list');
    }
    setSaving(false);
  }

  async function pauseRitual(ritualId: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('rituals').update({ active: false }).eq('id', ritualId);
    await trackEvent('ritual_skipped', { ritual_id: ritualId, reason_bucket: 'paused' });
    load();
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '14px 20px', background: 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18 }}>&#x1F501;</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Recurring Rituals</div>
          <div style={{ fontSize: 11, color: MUTED }}>Weekly anchors that build your social habit</div>
        </div>
      </div>
      <span style={{ fontSize: 12, color: MUTED }}>&#x25BC;</span>
    </button>
  );

  return (
    <div style={{ background: SURFACE, borderTop: '1px solid ' + BORDER }}>
      <button onClick={() => { setOpen(false); setStep('list'); }} style={{ width: '100%', padding: '14px 20px', background: ELEVATED, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>&#x1F501;</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>Recurring Rituals</div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>&#x25B2;</span>
      </button>
      <div style={{ padding: '16px 20px' }}>
        {step === 'list' && (
          <div>
            {rituals.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1F501;</div>
                <div style={{ fontSize: 13, color: TEXT2, marginBottom: 4 }}>No rituals yet</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>Weekly anchors like Comedy Tuesday or Coffee Walk Sunday generate a fresh suggestion pack every week.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {rituals.map((r: any) => (
                  <div key={r.id} style={{ padding: '12px 14px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Every {r.preferred_day} {r.preferred_time_window}</div>
                        {r.next_pack_at && <div style={{ fontSize: 11, color: GOLD, marginTop: 4 }}>Next: {new Date(r.next_pack_at).toLocaleDateString()}</div>}
                      </div>
                      <button onClick={() => pauseRitual(r.id)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 8, color: MUTED, fontSize: 11, cursor: 'pointer' }}>Pause</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setStep('create')} style={{ width: '100%', padding: '11px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New Ritual</button>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: MUTED, lineHeight: 1.5, textAlign: 'center' }}>Missing a ritual for safety reasons never affects your Integrity Score.</p>
          </div>
        )}
        {step === 'create' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ritual name (optional)</p>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Comedy Tuesday"
                style={{ width: '100%', padding: '10px 12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Activity</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activities.map((a: any) => (
                  <button key={a.id} onClick={() => setForm(f => ({ ...f, activity_id: a.id }))}
                    style={{ padding: '6px 12px', background: form.activity_id === a.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (form.activity_id === a.id ? GOLD : BORDER), borderRadius: 16, color: form.activity_id === a.id ? GOLD : MUTED, fontSize: 11, cursor: 'pointer' }}>
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Day</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DAYS.map(d => (
                  <button key={d} onClick={() => setForm(f => ({ ...f, preferred_day: d }))}
                    style={{ padding: '6px 10px', background: form.preferred_day === d ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (form.preferred_day === d ? GOLD : BORDER), borderRadius: 8, color: form.preferred_day === d ? GOLD : MUTED, fontSize: 11, cursor: 'pointer' }}>
                    {d.slice(0,3)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIMES.map(t => (
                  <button key={t.id} onClick={() => setForm(f => ({ ...f, preferred_time_window: t.id }))}
                    style={{ flex: 1, padding: '8px 4px', background: form.preferred_time_window === t.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (form.preferred_time_window === t.id ? GOLD : BORDER), borderRadius: 8, color: form.preferred_time_window === t.id ? GOLD : MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('list')} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveRitual} disabled={saving || !form.activity_id}
                style={{ flex: 2, padding: '10px', background: form.activity_id ? BRAND : ELEVATED, border: 'none', borderRadius: 10, color: form.activity_id ? '#fff' : MUTED, fontSize: 13, fontWeight: 600, cursor: form.activity_id ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Start Ritual'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
