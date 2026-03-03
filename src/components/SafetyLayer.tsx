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
const ERROR = '#C0444B';
const WARNING = '#D4A843';

export default function SafetyLayer({ matchId, userId, venueName, venueAddress, finalTime, inline = false }: {
  matchId: string; userId: string; venueName?: string; venueAddress?: string; finalTime?: string; inline?: boolean;
}) {
  const [settings, setSettings] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerEnd, setTimerEnd] = useState<string | null>(null);
  const [timerDuration, setTimerDuration] = useState(120);
  const [checkedIn, setCheckedIn] = useState(false);
  const [showPanic, setShowPanic] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [shareVenue, setShareVenue] = useState(false);
  const [panicSms, setPanicSms] = useState(false);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.from('safety_settings').select('*').eq('id', userId).single();
    if (data) {
      setSettings(data);
      setContactName(data.emergency_contact_name || '');
      setContactPhone(data.emergency_contact_phone || '');
      setContactRelation(data.emergency_contact_relation || '');
      setShareVenue(data.share_venue_with_contact || false);
      setPanicSms(data.panic_sms_enabled || false);
    }
  }

  async function save() {
    setSaving(true);
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('safety_settings').upsert({
      id: userId,
      emergency_contact_name: contactName || null,
      emergency_contact_phone: contactPhone || null,
      emergency_contact_relation: contactRelation || null,
      share_venue_with_contact: shareVenue,
      panic_sms_enabled: panicSms,
      updated_at: new Date().toISOString(),
    });
    await trackEvent('safety_contact_added', {}, matchId);
    await load();
    setSaving(false);
    setEditing(false);
  }

  function startTimer() {
    const end = new Date(Date.now() + timerDuration * 60000).toISOString();
    setTimerEnd(end);
    setTimerActive(true);
    setCheckedIn(false);
    trackEvent('safety_checkin_timer_set', { duration_mins: timerDuration }, matchId);
  }

  function checkIn() {
    setCheckedIn(true);
    setTimerActive(false);
    trackEvent('safety_checkin_completed', {}, matchId);
  }

  function getTimeLeft() {
    if (!timerEnd) return '';
    const diff = new Date(timerEnd).getTime() - Date.now();
    if (diff <= 0) return 'Timer expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? h + 'h ' + m + 'm left' : m + 'm left';
  }

  function buildSmsBody() {
    const time = finalTime ? new Date(finalTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'soon';
    const venue = venueName ? venueName + (venueAddress ? ', ' + venueAddress : '') : 'a public venue';
    return encodeURIComponent('I need help. I am on a date at ' + venue + ' at ' + time + '. Please check on me.');
  }

  const hasContact = settings?.emergency_contact_phone;
  const statusColor = checkedIn ? SUCCESS : timerActive ? WARNING : MUTED;
  const statusLabel = checkedIn ? 'Checked in — safe' : timerActive ? 'Timer active — ' + getTimeLeft() : hasContact ? 'Contact saved' : 'Set up safety';

  return (
    <div style={{ borderBottom: inline ? 'none' : '1px solid ' + BORDER }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '100%', padding: '13px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Safety Setup</div>
            <div style={{ fontSize: 11, color: statusColor }}>{statusLabel}</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Info banner */}
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Everything here is <strong style={{ color: TEXT2 }}>opt-in and private</strong>. Your emergency contact details are never shared with your match. BetterMate is not a substitute for emergency services — always call 911 in an emergency.
          </div>

          {/* Emergency Contact */}
          <div style={{ background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Emergency Contact</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  {hasContact ? settings.emergency_contact_name + ' · ' + settings.emergency_contact_phone : 'Not set up yet'}
                </div>
              </div>
              <button onClick={() => setEditing(!editing)}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 8, color: TEXT2, fontSize: 12, cursor: 'pointer' }}>
                {editing ? 'Cancel' : hasContact ? 'Edit' : 'Add'}
              </button>
            </div>

            {editing && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid ' + BORDER }}>
                <div style={{ paddingTop: 14 }} />
                {[
                  { label: 'Contact Name', value: contactName, set: setContactName, placeholder: 'e.g. Mom, Best Friend' },
                  { label: 'Phone Number', value: contactPhone, set: setContactPhone, placeholder: '+1 (555) 000-0000' },
                  { label: 'Relationship', value: contactRelation, set: setContactRelation, placeholder: 'e.g. Sister, Friend' },
                ].map((f, i) => (
                  <div key={i}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</p>
                    <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      style={{ width: '100%', padding: '11px 14px', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}

                <div>
                  <button onClick={() => setShareVenue(!shareVenue)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: shareVenue ? 'rgba(76,175,125,0.1)' : 'transparent', border: '1px solid ' + (shareVenue ? 'rgba(76,175,125,0.3)' : BORDER), borderRadius: 10, cursor: 'pointer', width: '100%' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, background: shareVenue ? SUCCESS : 'transparent', border: '2px solid ' + (shareVenue ? SUCCESS : BORDER), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {shareVenue && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, color: TEXT2, textAlign: 'left' }}>Share venue details with this contact when date is scheduled</span>
                  </button>
                </div>

                <div>
                  <button onClick={() => setPanicSms(!panicSms)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: panicSms ? 'rgba(76,175,125,0.1)' : 'transparent', border: '1px solid ' + (panicSms ? 'rgba(76,175,125,0.3)' : BORDER), borderRadius: 10, cursor: 'pointer', width: '100%' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, background: panicSms ? SUCCESS : 'transparent', border: '2px solid ' + (panicSms ? SUCCESS : BORDER), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {panicSms && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, color: TEXT2, textAlign: 'left' }}>Allow panic button to send SMS to this contact</span>
                  </button>
                </div>

                <button onClick={save} disabled={saving}
                  style={{ padding: '12px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            )}
          </div>

          {/* Check-in Timer */}
          <div style={{ background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER, padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Check-in Timer</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>
              Set a timer. If you do not check in before it expires, your emergency contact can be notified.
            </div>

            {checkedIn && (
              <div style={{ padding: '10px', background: 'rgba(76,175,125,0.1)', borderRadius: 10, border: '1px solid rgba(76,175,125,0.3)', textAlign: 'center', fontSize: 13, color: SUCCESS }}>
                ✓ Checked in — you are marked safe
              </div>
            )}

            {!checkedIn && !timerActive && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: MUTED }}>How long is your date?</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[60, 90, 120, 180].map(mins => (
                    <button key={mins} onClick={() => setTimerDuration(mins)}
                      style={{ flex: 1, padding: '9px 4px', background: timerDuration === mins ? 'rgba(132,82,184,0.2)' : SURFACE, border: '1px solid ' + (timerDuration === mins ? '#8452B8' : BORDER), borderRadius: 8, color: timerDuration === mins ? TEXT : TEXT2, fontSize: 12, cursor: 'pointer' }}>
                      {mins < 60 ? mins + 'm' : (mins / 60) + 'h'}
                    </button>
                  ))}
                </div>
                <button onClick={startTimer}
                  style={{ width: '100%', padding: '11px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Start Timer
                </button>
              </div>
            )}

            {timerActive && !checkedIn && (
              <div>
                <div style={{ padding: '12px', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', borderRadius: 10, textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 18, color: WARNING, fontWeight: 300 }}>{getTimeLeft()}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Tap below when you are safe</div>
                </div>
                <button onClick={checkIn}
                  style={{ width: '100%', padding: '12px', background: 'rgba(76,175,125,0.15)', border: '1px solid rgba(76,175,125,0.4)', borderRadius: 10, color: SUCCESS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ I am safe — check in
                </button>
              </div>
            )}
          </div>

          {/* Panic Button */}
          <div style={{ background: ELEVATED, borderRadius: 14, border: '1px solid rgba(192,68,75,0.3)', padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Emergency</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>
              This will open your phone dialer to call 911. {hasContact && panicSms ? 'It will also prepare an SMS to ' + settings.emergency_contact_name + '.' : ''}
            </div>

            {!showPanic ? (
              <button onClick={() => setShowPanic(true)}
                style={{ width: '100%', padding: '12px', background: 'rgba(192,68,75,0.1)', border: '1px solid rgba(192,68,75,0.4)', borderRadius: 10, color: ERROR, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🆘 I Need Help
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 12, color: WARNING, lineHeight: 1.6 }}>
                  This will open your phone dialer. BetterMate cannot call emergency services for you — you must make the call.
                </p>
                <a href="tel:911"
                  onClick={() => trackEvent('safety_panic_opened', {}, matchId)}
                  style={{ display: 'block', padding: '13px', background: ERROR, borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                  📞 Call 911
                </a>
                {hasContact && panicSms && (
                  <a href={'sms:' + settings.emergency_contact_phone + '?body=' + buildSmsBody()}
                    onClick={() => trackEvent('safety_panic_sms_sent', {}, matchId)}
                    style={{ display: 'block', padding: '11px', background: 'rgba(192,68,75,0.15)', border: '1px solid rgba(192,68,75,0.4)', borderRadius: 10, color: ERROR, fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
                    Send SOS to {settings.emergency_contact_name}
                  </a>
                )}
                <button onClick={() => setShowPanic(false)}
                  style={{ padding: '10px', background: 'transparent', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
