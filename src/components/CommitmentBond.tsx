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
const GOLD2 = '#E2C488';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';

type BondStatus = 'none' | 'pending_sent' | 'pending_received' | 'bonded' | 'declined';

export default function CommitmentBond({ matchId, userId }: { matchId: string; userId: string }) {
  const [status, setStatus] = useState<BondStatus>('none');
  const [bondedAt, setBondedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { load(); }, [matchId, userId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: match } = await supabase
      .from('matches')
      .select('bond_status, bonded_at')
      .eq('id', matchId)
      .single();

    if (match?.bond_status === 'bonded') {
      setStatus('bonded');
      setBondedAt(match.bonded_at);
      setLoading(false);
      return;
    }

    const { data: request } = await supabase
      .from('bond_requests')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (!request) { setStatus('none'); setLoading(false); return; }
    if (request.status === 'declined') { setStatus('declined'); setLoading(false); return; }
    if (request.status === 'accepted') { setStatus('bonded'); setLoading(false); return; }
    if (request.proposer_id === userId) { setStatus('pending_sent'); }
    else { setStatus('pending_received'); }
    setLoading(false);
  }

  async function propose() {
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: match } = await supabase
      .from('matches')
      .select('user1_id, user2_id')
      .eq('id', matchId)
      .single();

    if (!match) { setActing(false); return; }
    const responderId = match.user1_id === userId ? match.user2_id : match.user1_id;

    await supabase.from('bond_requests').upsert({
      match_id: matchId,
      proposer_id: userId,
      responder_id: responderId,
      status: 'pending',
      proposed_at: new Date().toISOString(),
    });

    await supabase.from('messages').insert({
      match_id: matchId,
      sender_user_id: userId,
      body: '💎 I would like to form a Commitment Bond with you. This means we focus on each other — exclusively and intentionally.',
    });

    await trackEvent('bond_proposed', {}, matchId);
    setStatus('pending_sent');
    setShowConfirm(false);
    setActing(false);
  }

  async function respond(accept: boolean) {
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase.from('bond_requests')
      .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
      .eq('match_id', matchId);

    if (accept) {
      const now = new Date().toISOString();
      await supabase.from('matches')
        .update({ bond_status: 'bonded', bonded_at: now })
        .eq('id', matchId);

      await supabase.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: '💎 I accept. We are bonded.',
      });

      await trackEvent('bond_accepted', {}, matchId);
      setBondedAt(now);
      setStatus('bonded');
    } else {
      await supabase.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: 'I appreciate the intention. I am not ready for a bond yet.',
      });
      await trackEvent('bond_declined', {}, matchId);
      setStatus('declined');
    }
    setActing(false);
  }

  if (loading) return null;

  // BONDED state — permanent beautiful card
  if (status === 'bonded') return (
    <div style={{ margin: '0', borderBottom: '1px solid ' + BORDER }}>
      <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(123,28,74,0.12))', borderTop: '1px solid rgba(201,169,110,0.3)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>💎</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: '0.05em' }}>Commitment Bond Active</div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>You have chosen each other — intentionally and exclusively.</div>
          {bondedAt && <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Bonded {new Date(bondedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>}
        </div>
      </div>
    </div>
  );

  // PENDING RECEIVED — they proposed to you
  if (status === 'pending_received') return (
    <div style={{ margin: '0', borderBottom: '1px solid ' + BORDER }}>
      <div style={{ padding: '18px 20px', background: 'rgba(201,169,110,0.08)', borderTop: '1px solid rgba(201,169,110,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>💎</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, marginBottom: 4 }}>A Bond Has Been Proposed</div>
            <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>They are asking to focus on each other — exclusively and intentionally. This is a meaningful step.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => respond(true)} disabled={acting}
            style={{ flex: 1, padding: '12px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {acting ? '...' : '💎 Accept Bond'}
          </button>
          <button onClick={() => respond(false)} disabled={acting}
            style={{ flex: 1, padding: '12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 14, cursor: 'pointer' }}>
            Not yet
          </button>
        </div>
      </div>
    </div>
  );

  // PENDING SENT — waiting for response
  if (status === 'pending_sent') return (
    <div style={{ margin: '0', borderBottom: '1px solid ' + BORDER }}>
      <div style={{ padding: '14px 20px', background: 'rgba(201,169,110,0.06)', borderTop: '1px solid rgba(201,169,110,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>💎</span>
        <div>
          <div style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>Bond Proposed</div>
          <div style={{ fontSize: 12, color: MUTED }}>Waiting for their response...</div>
        </div>
      </div>
    </div>
  );

  // DECLINED
  if (status === 'declined') return null;

  // Confirm dialog
  if (showConfirm) return (
    <div style={{ margin: '0', borderBottom: '1px solid ' + BORDER }}>
      <div style={{ padding: '20px', background: SURFACE, borderTop: '1px solid ' + BORDER }}>
        <div style={{ fontSize: 24, textAlign: 'center', marginBottom: 12 }}>💎</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: GOLD, textAlign: 'center', fontFamily: 'Georgia, serif', fontWeight: 400 }}>Propose a Commitment Bond</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: TEXT2, lineHeight: 1.7, textAlign: 'center' }}>
          A Commitment Bond means you both agree to focus on each other — no parallel conversations, no hedging. It is an intentional choice to go deeper together.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={propose} disabled={acting}
            style={{ flex: 1, padding: '13px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {acting ? 'Sending...' : 'Propose Bond'}
          </button>
          <button onClick={() => setShowConfirm(false)}
            style={{ flex: 1, padding: '13px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // DEFAULT — propose button
  return (
    <div style={{ margin: '0', borderBottom: '1px solid ' + BORDER }}>
      <button onClick={() => setShowConfirm(true)}
        style={{ width: '100%', padding: '13px 20px', background: 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>💎</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Commitment Bond</div>
            <div style={{ fontSize: 11, color: MUTED }}>Propose to focus on each other exclusively</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>→</span>
      </button>
    </div>
  );
}
