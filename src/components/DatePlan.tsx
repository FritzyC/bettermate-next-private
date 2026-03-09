'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';
import { buildFairnessPrompt, getFairnessColor, getFairnessIcon } from '@/lib/geofairness';
import { getTopPreferences } from '@/components/PreferenceLearning';
import { getPreferences } from '@/components/PreferenceLearning';
import VenueRating from '@/components/VenueRating';
import ExplainableMatch from '@/components/ExplainableMatch';

const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const GOLD = '#C9A96E';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const SUCCESS = '#4CAF7D';
const WARNING = '#D4A843';
const ERROR = '#C0444B';

function formatCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h remaining';
  return h + 'h ' + m + 'm remaining';
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DatePlan({ matchId, userId, inline = false }: { matchId: string; userId: string; inline?: boolean }) {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [userLocation, setUserLocation] = useState<{ city: string; lat: number; lng: number } | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [generatingVenues, setGeneratingVenues] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [travelMode, setTravelMode] = useState<'car'|'transit'|'walk'>('car');
  const [fairnessOpen, setFairnessOpen] = useState<string|null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [safetyFlag, setSafetyFlag] = useState(false);

  useEffect(() => { load(); }, [matchId, userId]);

  useEffect(() => {
    if (!plan?.commitment_deadline_at) return;
    const interval = setInterval(() => setCountdown(formatCountdown(plan.commitment_deadline_at)), 30000);
    setCountdown(formatCountdown(plan.commitment_deadline_at));
    return () => clearInterval(interval);
  }, [plan]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.from('date_plans').select('*').eq('match_id', matchId).single();
    if (data) {
      setPlan(data);
      const isA = data.user_a_id === userId;
      if (isA) setSelectedVenue(data.user_a_choice);
      else setSelectedVenue(data.user_b_choice);
    }
    setLoading(false);
  }

  async function startPlan() {
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: match } = await supabase.from('matches').select('user_a_id, user_b_id').eq('id', matchId).single();
    if (!match) { setActing(false); return; }

    const deadline = new Date(Date.now() + 72 * 3600000).toISOString();
    const { data: newPlan } = await supabase.from('date_plans').insert({
      match_id: matchId,
      user_a_id: match.user_a_id,
      user_b_id: match.user_b_id,
      status: 'pending_commitment',
      commitment_deadline_at: deadline,
    }).select().single();

    setPlan(newPlan);
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_user_id: userId,
      body: '📅 I started a 72-Hour Date Commitment. We have 72 hours to agree on a place to meet.',
    });
    await trackEvent('plan_started', {}, matchId);
    setActing(false);
    setShowLocationInput(true);
  }

  async function generateVenues() {
    // Load user preferences for tag hints
    let preferredTags: string[] = [];
    try {
      const prefs = await getPreferences(userId);
      if (prefs) preferredTags = await getTopPreferences(prefs, 3);
    } catch {}
    if (!locationInput.trim()) return;
    setGeneratingVenues(true);
    const supabase = getSupabase();
    if (!supabase) return;

    // Build fairness prompt
    const [fingerprintA, fingerprintB] = await Promise.all([
      supabase.from('user_fingerprint').select('hobbies,music').eq('id', userId).single().then(r => r.data),
      supabase.from('user_fingerprint').select('hobbies,music').eq('id', plan?.user_b_id === userId ? plan?.user_a_id : plan?.user_b_id).single().then(r => r.data),
    ]);
    const prompt = buildFairnessPrompt(locationInput, locationInput, travelMode, fingerprintA, fingerprintB, preferredTags);

    try {
      const res = await fetch('/api/venue-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationA: locationInput, locationB: locationInput, travelMode, tags: preferredTags }),
      });
      const data = await res.json();
      const venues = data.venues ?? [];
      if (venues.length === 0) throw new Error('No venues returned');

      const supabase2 = getSupabase();
      if (!supabase2) return;
      const { data: updated } = await supabase2.from('date_plans')
        .update({ venue_options: venues, status: 'venues_presented' })
        .eq('match_id', matchId).select().single();
      setPlan(updated);

      await supabase2.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: '📍 BetterMate suggested 3 venues for your date. Open the Date Plan to vote.',
      });
      await trackEvent('plan_venues_presented', { count: venues.length, mode: 'fairness_2', sources: ['a_area','b_area','midpoint'] }, matchId);
    } catch (_) {}
    setGeneratingVenues(false);
    setShowLocationInput(false);
  }

  async function selectVenue(venueId: string) {
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const isA = plan.user_a_id === userId;
    const update = isA ? { user_a_choice: venueId } : { user_b_choice: venueId };
    const otherChoice = isA ? plan.user_b_choice : plan.user_a_choice;

    let finalUpdate: any = { ...update };
    if (otherChoice === venueId) {
      const venue = plan.venue_options.find((v: any) => v.id === venueId);
      finalUpdate = { ...update, final_venue: venue, status: 'venue_confirmed' };
      await supabase.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: '✅ Both agreed on ' + venue?.name + '. Now let\'s pick a time.',
      });
      await trackEvent('plan_venue_confirmed', { venue_id: venueId }, matchId);
      await trackEvent('plan_confirmed', { venue_id: venueId, time: null, mode: 'midpoint' }, matchId);
    } else if (otherChoice && otherChoice !== venueId) {
      finalUpdate = { ...update, status: 'venue_mismatch' };
      await trackEvent('plan_venue_mismatch', {}, matchId);
    } else {
      const selVenue = plan?.venue_options?.find((v: any) => v.id === venueId);
await trackEvent('plan_venue_selected', { venue_id: venueId, fairness_bucket: selVenue?.fairness?.bucket || 'unknown' }, matchId);
    }

    const { data: updated } = await supabase.from('date_plans').update(finalUpdate).eq('match_id', matchId).select().single();
    setPlan(updated);
    setSelectedVenue(venueId);
    setActing(false);
  }

  async function selectTime(time: string) {
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const isA = plan.user_a_id === userId;
    const times = plan.proposed_times || [];
    const myTime = time;
    const otherTime = isA ? times.find((t: any) => t.user === 'b')?.time : times.find((t: any) => t.user === 'a')?.time;
    const tag = isA ? 'a' : 'b';
    const newTimes = [...times.filter((t: any) => t.user !== tag), { user: tag, time }];

    let update: any = { proposed_times: newTimes };
    if (otherTime === time) {
      const checkinDeadline = new Date(new Date(time).getTime() + 24 * 3600000).toISOString();
      update = { ...update, final_time: time, status: 'plan_scheduled', checkin_deadline_at: checkinDeadline };
      await supabase.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: '🗓 Date confirmed for ' + formatDateTime(time) + '. See you there.',
      });
      await trackEvent('plan_time_confirmed', { time }, matchId);
    } else {
      await trackEvent('plan_time_selected', { time }, matchId);
    }

    const { data: updated } = await supabase.from('date_plans').update(update).eq('match_id', matchId).select().single();
    setPlan(updated);
    setSelectedTime(time);
    setActing(false);
  }

  async function checkin(showed: boolean) {
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const isA = plan.user_a_id === userId;
    const update = isA ? { user_a_checked_in: showed } : { user_b_checked_in: showed };
    const otherCheckedIn = isA ? plan.user_b_checked_in : plan.user_a_checked_in;

    let finalUpdate: any = { ...update };
    if (showed && otherCheckedIn) {
      finalUpdate = { ...update, status: 'completed_checked_in' };
      await supabase.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: '✨ Both confirmed the date. This is how real connection starts.',
      });
    } else if (!showed) {
      finalUpdate = { ...update, status: 'penalty_applied' };
    }

    const { data: updated } = await supabase.from('date_plans').update(finalUpdate).eq('match_id', matchId).select().single();
    setPlan(updated);
    await trackEvent('plan_checkin_prompt_shown', {}, matchId);
      await trackEvent('plan_checkin_confirmed', { showed, outcome: showed ? 'met' : 'rescheduled', safety_flag: false }, matchId);
      if (showed) setShowRating(true);
    setActing(false);
    setShowCheckin(false);
  }

  async function cancelPlan() {
    if (!cancelReason) return;
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('date_plans').update({ status: 'cancelled_by_user', cancellation_reason: cancelReason, safety_flag: safetyFlag }).eq('match_id', matchId);
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_user_id: userId,
      body: safetyFlag ? '🔒 Date plan cancelled for safety reasons.' : '📅 Date plan cancelled.',
    });
    await trackEvent('plan_cancelled', { reason: cancelReason, safety_flag: safetyFlag }, matchId);
    setPlan(null);
    setActing(false);
    setShowCancel(false);
  }

  if (loading) return null;

  const isA = plan?.user_a_id === userId;
  const myCheckedIn = plan ? (isA ? plan.user_a_checked_in : plan.user_b_checked_in) : false;
  const status = plan?.status;
  const isExpired = plan?.commitment_deadline_at && new Date(plan.commitment_deadline_at) < new Date() && !['venue_confirmed', 'plan_scheduled', 'completed_checked_in'].includes(status);

  const statusLabel = () => {
    if (!plan) return 'Start a 72-hour date commitment';
    if (isExpired) return '⚠️ Commitment window expired';
    if (status === 'completed_checked_in') return '✨ Date completed';
    if (status === 'cancelled_by_user') return 'Plan cancelled';
    if (status === 'plan_scheduled') return '🗓 Date scheduled — ' + (plan.final_time ? formatDateTime(plan.final_time) : '');
    if (status === 'venue_confirmed') return '✅ Venue agreed — pick a time';
    if (status === 'venue_mismatch') return '🔄 Different choices — revote needed';
    if (status === 'venues_presented') return '📍 Vote on a venue';
    if (status === 'pending_commitment') return '⏳ Generating venues...';
    return 'Open date plan';
  };

  const countdownColor = () => {
    if (!plan?.commitment_deadline_at) return MUTED;
    const h = (new Date(plan.commitment_deadline_at).getTime() - Date.now()) / 3600000;
    if (h < 12) return ERROR;
    if (h < 24) return WARNING;
    return GOLD;
  };

  return (
    <div style={{ borderBottom: inline ? 'none' : '1px solid ' + BORDER }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '100%', padding: '13px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: status === 'completed_checked_in' ? SUCCESS : TEXT2 }}>72-Hour Date Commitment</div>
            <div style={{ fontSize: 11, color: MUTED }}>{statusLabel()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {plan?.commitment_deadline_at && !['completed_checked_in', 'cancelled_by_user', 'plan_scheduled'].includes(status) && (
            <span style={{ fontSize: 10, color: countdownColor(), fontWeight: 600 }}>{countdown}</span>
          )}
          <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: '20px' }}>

          {/* NO PLAN YET */}
          {!plan && (
            <div>
              <div style={{ padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER, marginBottom: 16 }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, color: TEXT, lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
                  "Within 72 hours, both of you commit to meeting at one of 3 BetterMate-suggested venues. No endless planning. Real intention."
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: TEXT2 }}>
                  {[
                    '📍 BetterMate suggests 3 venues based on your shared interests',
                    '🗳 Both vote — if you agree, it is confirmed',
                    '⏱ 72 hours to lock in a plan or the window expires',
                    '✅ Both check in after the date to confirm it happened',
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>{item}</div>
                  ))}
                </div>
              </div>
              <button onClick={startPlan} disabled={acting}
                style={{ width: '100%', padding: '14px', background: BRAND, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {acting ? 'Starting...' : 'Start 72-Hour Commitment'}
              </button>
            </div>
          )}

          {/* LOCATION INPUT */}
          {(showLocationInput || (plan && status === 'pending_commitment' && (!plan.venue_options || plan.venue_options.length === 0))) && (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
                Share your approximate location so BetterMate can suggest venues near the midpoint between you two.
              </p>
              <input value={locationInput} onChange={e => setLocationInput(e.target.value)}
                placeholder="Your city or neighborhood (e.g. Brooklyn, NY)"
                style={{ width: '100%', padding: '13px 16px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 12, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['car', 'transit', 'walk'] as const).map(mode => (
                  <button key={mode} onClick={() => setTravelMode(mode)}
                    style={{ flex: 1, padding: '7px 4px', background: travelMode === mode ? 'rgba(201,169,110,0.15)' : 'transparent', border: '1px solid ' + (travelMode === mode ? '#C9A96E' : '#5A3A8A'), borderRadius: 8, color: travelMode === mode ? '#C9A96E' : '#7A6A96', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {mode === 'car' ? '🚗 Drive' : mode === 'transit' ? '🚌 Transit' : '🚶 Walk'}
                  </button>
                ))}
              </div>
              <button onClick={generateVenues} disabled={!locationInput.trim() || generatingVenues}
                style={{ width: '100%', padding: '13px', background: locationInput.trim() ? BRAND : ELEVATED, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: locationInput.trim() ? 'pointer' : 'not-allowed' }}>
                {generatingVenues ? '🔍 Finding perfect venues...' : 'Suggest 3 Venues'}
              </button>
            </div>
          )}

          {/* VENUE OPTIONS */}
          {plan?.venue_options?.length > 0 && ['venues_presented', 'venue_mismatch'].includes(status) && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Choose your preferred venue</p>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: MUTED }}>Both of you vote. If you pick the same one, it's confirmed.</p>
              {status === 'venue_mismatch' && (
                <div style={{ padding: '10px 14px', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', borderRadius: 10, marginBottom: 16, fontSize: 12, color: WARNING }}>
                  You picked different venues. Review your options and revote — find your fair plan.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {plan.venue_options.map((venue: any) => {
                  const myChoice = isA ? plan.user_a_choice : plan.user_b_choice;
                  const theirChoice = isA ? plan.user_b_choice : plan.user_a_choice;
                  const isMine = myChoice === venue.id;
                  const isTheirs = theirChoice === venue.id;
                  return (
                    <button key={venue.id} onClick={() => !acting && selectVenue(venue.id)}
                      style={{ background: isMine ? 'rgba(123,28,74,0.2)' : ELEVATED, border: '1px solid ' + (isMine ? '#7B1C4A' : BORDER), borderRadius: 14, padding: '16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{venue.name}</div>
                        <ExplainableMatch
                          matchId={matchId}
                          userId={userId}
                          venueId={venue.place_id || venue.name}
                          venueName={venue.name}
                          venueCategory={venue.type || venue.category || 'venue'}
                          isMidpoint={true}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          {isMine && <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(123,28,74,0.3)', borderRadius: 10, color: '#f0a0c0' }}>Your pick</span>}
                          {isTheirs && <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(76,175,125,0.2)', borderRadius: 10, color: SUCCESS }}>Their pick</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{venue.address}</div>
                      <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.5, marginBottom: 8 }}>✨ {venue.why}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{venue.midpoint_note}</div>
                      {venue.fairness && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', background: getFairnessColor(venue.fairness.bucket) + '20', border: '1px solid ' + getFairnessColor(venue.fairness.bucket) + '50', borderRadius: 12, color: getFairnessColor(venue.fairness.bucket), fontWeight: 600 }}>
                            {getFairnessIcon(venue.fairness.bucket)} {venue.fairness.label}
                          </span>
                          {venue.travel_time_a_bucket && (
                            <span style={{ fontSize: 10, color: '#7A6A96' }}>You: {venue.travel_time_a_bucket}</span>
                          )}
                          {venue.travel_time_b_bucket && (
                            <span style={{ fontSize: 10, color: '#7A6A96' }}>Them: {venue.travel_time_b_bucket}</span>
                          )}
                          <button onClick={e => { e.stopPropagation(); setFairnessOpen(fairnessOpen === venue.id ? null : venue.id); trackEvent('plan_fairness_explainer_opened', { venue_id: venue.id }, matchId); }}
                            style={{ background: 'none', border: 'none', color: '#7A6A96', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}>
                            Why fair?
                          </button>
                        </div>
                      )}
                      {fairnessOpen === venue.id && venue.fairness?.explanation && (
                        <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 11, color: '#B8A8D4', lineHeight: 1.5 }}>
                          {venue.fairness.explanation}
                        </div>
                      )}
                      {venue.special_event && venue.event_note && (
                        <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(201,169,110,0.1)', borderRadius: 8, fontSize: 11, color: GOLD }}>🎵 {venue.event_note}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* VENUE CONFIRMED — PICK TIME */}
          {status === 'venue_confirmed' && plan.final_venue && (
            <div>
              <div style={{ padding: '14px', background: ELEVATED, borderRadius: 12, border: '1px solid rgba(76,175,125,0.3)', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: SUCCESS, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Venue Agreed</div>
                <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{plan.final_venue.name}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{plan.final_venue.address}</div>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: TEXT2 }}>Now pick a time. Both need to select the same slot to confirm.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(plan.final_venue.suggested_times || []).map((time: string, i: number) => {
                  const myTimes = plan.proposed_times || [];
                  const tag = isA ? 'a' : 'b';
                  const myTime = myTimes.find((t: any) => t.user === tag)?.time;
                  const theirTag = isA ? 'b' : 'a';
                  const theirTime = myTimes.find((t: any) => t.user === theirTag)?.time;
                  const isMine = myTime === time;
                  const isTheirs = theirTime === time;
                  return (
                    <button key={i} onClick={() => !acting && selectTime(time)}
                      style={{ padding: '12px 16px', background: isMine ? 'rgba(123,28,74,0.2)' : ELEVATED, border: '1px solid ' + (isMine ? '#7B1C4A' : BORDER), borderRadius: 10, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: TEXT }}>{time}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {isMine && <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(123,28,74,0.3)', borderRadius: 10, color: '#f0a0c0' }}>You</span>}
                        {isTheirs && <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(76,175,125,0.2)', borderRadius: 10, color: SUCCESS }}>Them</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PLAN SCHEDULED */}
          {status === 'plan_scheduled' && (
            <div>
              <div style={{ padding: '20px', background: ELEVATED, borderRadius: 14, border: '1px solid rgba(201,169,110,0.3)', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
                <div style={{ fontSize: 13, color: GOLD, fontWeight: 600, marginBottom: 4 }}>Date Scheduled</div>
                <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>{plan.final_venue?.name}</div>
                <div style={{ fontSize: 13, color: TEXT2, marginTop: 4 }}>{plan.final_time ? formatDateTime(plan.final_time) : ''}</div>
              </div>

              {/* Maps & Directions */}
              {plan.final_venue && (
                <div style={{ padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER, marginBottom: 16 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 11, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Get Directions</p>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                    📍 {plan.final_venue.name} — {plan.final_venue.address}
                  </p>
                  <p style={{ margin: '0 0 14px', fontSize: 12, color: TEXT2, lineHeight: 1.5 }}>
                    Arrive independently. Meet in public. Your safety comes first.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <a href={'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent((plan.final_venue.address || plan.final_venue.name))}
                      target="_blank" rel="noopener noreferrer"
                      onClick={() => { trackEvent('plan_maps_clicked', { provider: 'google' }, matchId); trackEvent('plan_maps_directions_clicked', { provider: 'google' }, matchId); }}
                      style={{ flex: 1, padding: '11px', background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.3)', borderRadius: 10, color: '#6BA3F5', fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                      🗺 Google Maps
                    </a>
                    <a href={'https://waze.com/ul?q=' + encodeURIComponent((plan.final_venue.address || plan.final_venue.name))}
                      target="_blank" rel="noopener noreferrer"
                      onClick={() => { trackEvent('plan_maps_clicked', { provider: 'waze' }, matchId); trackEvent('plan_maps_directions_clicked', { provider: 'waze' }, matchId); }}
                      style={{ flex: 1, padding: '11px', background: 'rgba(0,210,91,0.1)', border: '1px solid rgba(0,210,91,0.25)', borderRadius: 10, color: '#00D25B', fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                      🚗 Waze
                    </a>
                  </div>
                  {plan.final_time && (
                    <div style={{ padding: '10px 14px', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 10 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, color: GOLD, fontWeight: 600 }}>Leave by suggestion</p>
                      <p style={{ margin: 0, fontSize: 13, color: TEXT2 }}>
                        Plan to leave at least 30 minutes before {new Date(plan.final_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} to arrive on time.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: GOLD, fontWeight: 600 }}>Pre-Date Checklist</p>
                {['Tell someone you trust where you are going', 'Arrive at a public, well-lit place', 'Keep your phone charged', 'You can always leave — your safety comes first'].map((item, i) => (
                  <div key={i} style={{ fontSize: 12, color: TEXT2, padding: '5px 0', borderBottom: i < 3 ? '1px solid ' + BORDER : 'none' }}>✓ {item}</div>
                ))}
              </div>
              {!myCheckedIn && (
                <button onClick={() => setShowCheckin(true)}
                  style={{ width: '100%', padding: '13px', background: BRAND, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
                  ✓ We went on our date
                </button>
              )}
              {myCheckedIn && (
                <div style={{ padding: '12px', background: 'rgba(76,175,125,0.1)', borderRadius: 10, border: '1px solid rgba(76,175,125,0.3)', textAlign: 'center', fontSize: 13, color: SUCCESS, marginBottom: 8 }}>
                  ✓ You confirmed — waiting for them to confirm
                </div>
              )}
              <button onClick={() => setShowCancel(true)}
                style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
                Cancel or report safety concern
              </button>
            </div>
          )}

          {/* CHECKIN MODAL */}
          {showCheckin && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,4,26,0.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: SURFACE, borderRadius: 20, padding: 28, maxWidth: 380, width: '100%', border: '1px solid ' + BORDER }}>
                <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>✨</div>
                <h3 style={{ margin: '0 0 12px', fontSize: 18, color: TEXT, textAlign: 'center', fontFamily: 'Georgia, serif', fontWeight: 400 }}>Did you go on the date?</h3>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: TEXT2, textAlign: 'center', lineHeight: 1.6 }}>Both need to confirm. Your honesty keeps BetterMate trustworthy for everyone.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => checkin(true)} disabled={acting}
                    style={{ flex: 1, padding: '13px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Yes, we met
                  </button>
                  <button onClick={() => checkin(false)} disabled={acting}
                    style={{ flex: 1, padding: '13px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer' }}>
                    We did not meet
                  </button>
                </div>
                <button onClick={() => setShowCheckin(false)} style={{ width: '100%', marginTop: 10, padding: '10px', background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* CANCEL MODAL */}
          {showCancel && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,4,26,0.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: SURFACE, borderRadius: 20, padding: 28, maxWidth: 380, width: '100%', border: '1px solid ' + BORDER }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, color: TEXT, fontFamily: 'Georgia, serif', fontWeight: 400 }}>Cancel Date Plan</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: MUTED }}>Your safety is always the priority. You can always cancel.</p>
                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  placeholder="Reason for cancelling (optional but appreciated)..."
                  rows={3} style={{ width: '100%', padding: '12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'system-ui', boxSizing: 'border-box', marginBottom: 12 }} />
                <button onClick={() => setSafetyFlag(!safetyFlag)}
                  style={{ width: '100%', padding: '10px', background: safetyFlag ? 'rgba(192,68,75,0.15)' : ELEVATED, border: '1px solid ' + (safetyFlag ? ERROR : BORDER), borderRadius: 10, color: safetyFlag ? ERROR : MUTED, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
                  {safetyFlag ? '🔒 Safety concern flagged' : 'Flag as safety concern'}
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={cancelPlan} disabled={acting}
                    style={{ flex: 1, padding: '12px', background: 'rgba(192,68,75,0.2)', border: '1px solid ' + ERROR, borderRadius: 10, color: ERROR, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {acting ? '...' : 'Cancel Plan'}
                  </button>
                  <button onClick={() => setShowCancel(false)}
                    style={{ flex: 1, padding: '12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer' }}>
                    Go back
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* COMPLETED */}
          {status === 'completed_checked_in' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <p style={{ margin: '0 0 8px', fontSize: 16, color: GOLD, fontWeight: 600 }}>Date Complete</p>
              <p style={{ margin: 0, fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>Both confirmed. This is what intention looks like in action.</p>
            </div>
          )}

          {/* EXPIRED */}
          {isExpired && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏰</div>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: WARNING }}>The 72-hour window expired without a confirmed plan.</p>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: MUTED }}>Both of you can opt in to restart a fresh 72-hour window.</p>
              <button onClick={startPlan} disabled={acting}
                style={{ padding: '12px 24px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Restart Commitment Window
              </button>
            </div>
          )}

          {/* CANCELLED */}
          {status === 'cancelled_by_user' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: MUTED }}>This date plan was cancelled. You can start a new one when ready.</p>
              <button onClick={startPlan}
                style={{ padding: '12px 24px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Start New Plan
              </button>
            </div>
          )}

          {/* Cancel link for active states */}
          {plan && !['completed_checked_in', 'cancelled_by_user', 'plan_scheduled'].includes(status) && !isExpired && !showLocationInput && (
            <button onClick={() => setShowCancel(true)} style={{ width: '100%', marginTop: 16, padding: '8px', background: 'none', border: 'none', color: MUTED, fontSize: 11, cursor: 'pointer' }}>
              Cancel plan or flag safety concern
            </button>
          )}

        </div>
      )}
    </div>
  );
}
