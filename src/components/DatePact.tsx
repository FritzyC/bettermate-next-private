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

type PactStatus = 'none' | 'pending_deposit' | 'waiting' | 'active' | 'confirming' | 'settled_success' | 'settled_flake';

function formatTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h left';
  return hours + 'h ' + mins + 'm left';
}

export default function DatePact({ matchId, userId }: { matchId: string; userId: string }) {
  const [pact, setPact] = useState<any>(null);
  const [status, setStatus] = useState<PactStatus>('none');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [open, setOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { load(); }, [matchId, userId]);

  useEffect(() => {
    if (!pact?.deadline || status !== 'active') return;
    const interval = setInterval(() => setTimeLeft(formatTimeLeft(pact.deadline)), 60000);
    setTimeLeft(formatTimeLeft(pact.deadline));
    return () => clearInterval(interval);
  }, [pact, status]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;

    const [{ data: p }, { data: credits }] = await Promise.all([
      supabase.from('date_pacts').select('*').eq('match_id', matchId).single(),
      supabase.from('user_credits').select('balance').eq('user_id', userId).single(),
    ]);

    setBalance(credits?.balance ?? 0);

    if (!p) { setStatus('none'); setLoading(false); return; }
    setPact(p);

    const iU1 = p.user1_id === userId;
    const myDeposited = iU1 ? p.user1_deposited : p.user2_deposited;
    const theirDeposited = iU1 ? p.user2_deposited : p.user1_deposited;
    const myConfirmed = iU1 ? p.user1_confirmed : p.user2_confirmed;

    if (p.status === 'settled_success') { setStatus('settled_success'); }
    else if (p.status === 'settled_flake') { setStatus('settled_flake'); }
    else if (p.status === 'active' && !myConfirmed) { setStatus('confirming'); }
    else if (p.status === 'active') { setStatus('active'); }
    else if (!myDeposited) { setStatus('pending_deposit'); }
    else if (!theirDeposited) { setStatus('waiting'); }
    else { setStatus('active'); }

    setLoading(false);
  }

  async function deposit() {
    if (balance < 1500) return;
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: match } = await supabase.from('matches').select('user1_id, user2_id').eq('id', matchId).single();
    if (!match) { setActing(false); return; }

    const isUser1 = match.user1_id === userId;
    const otherId = isUser1 ? match.user2_id : match.user1_id;

    // Deduct from wallet
    await supabase.from('user_credits').update({ balance: balance - 1500, updated_at: new Date().toISOString() }).eq('user_id', userId);
    setBalance(b => b - 1500);

    // Create or update pact
    const existing = pact;
    if (!existing) {
      const deadline = new Date(Date.now() + 168 * 3600000).toISOString();
      const { data: newPact } = await supabase.from('date_pacts').insert({
        match_id: matchId,
        user1_id: userId,
        user2_id: otherId,
        user1_deposited: true,
        deadline,
        status: 'pending',
      }).select().single();
      setPact(newPact);

      await supabase.from('messages').insert({
        match_id: matchId,
        sender_user_id: userId,
        body: '🤝 I have deposited $15 into the Date Pact. We have 7 days to meet in person. Your move.',
      });
    } else {
      const update = isUser1 ? { user1_deposited: true } : { user2_deposited: true };
      const bothDeposited = isUser1 ? existing.user2_deposited : existing.user1_deposited;
      const finalUpdate = bothDeposited ? { ...update, status: 'active' } : update;
      const { data: updated } = await supabase.from('date_pacts').update(finalUpdate).eq('match_id', matchId).select().single();
      setPact(updated);

      if (bothDeposited) {
        await supabase.from('matches').update({ pact_status: 'active' }).eq('id', matchId);
        await supabase.from('messages').insert({
          match_id: matchId,
          sender_user_id: userId,
          body: '🤝 Both deposits confirmed. The Date Pact is active. You have 7 days to meet.',
        });
        setTimeLeft(formatTimeLeft(existing.deadline));
        setStatus('active');
      } else {
        await supabase.from('messages').insert({
          match_id: matchId,
          sender_user_id: userId,
          body: '🤝 I have deposited $15 into the Date Pact. Waiting for your deposit to activate.',
        });
        setStatus('waiting');
      }
    }

    await trackEvent('date_pact_deposit', {}, matchId);
    setActing(false);
    setStatus(pact?.user2_deposited || pact?.user1_deposited ? 'active' : 'waiting');
  }

  async function confirmDate(showed: boolean) {
    setActing(true);
    const supabase = getSupabase();
    if (!supabase) return;

    const isU1 = pact.user1_id === userId;
    const update = isU1
      ? (showed ? { user1_confirmed: true } : { user1_flaked: true })
      : (showed ? { user2_confirmed: true } : { user2_flaked: true });

    const { data: updated } = await supabase.from('date_pacts').update(update).eq('match_id', matchId).select().single();
    setPact(updated);

    const bothConfirmed = isU1 ? (showed && updated.user2_confirmed) : (showed && updated.user1_confirmed);
    const iFlaked = !showed;
    const theyFlaked = isU1 ? updated.user2_flaked : updated.user1_flaked;

    if (bothConfirmed) {
      // Return all credits
      await Promise.all([
        supabase.from('user_credits').select('balance').eq('user_id', pact.user1_id).single()
          .then(({ data }) => supabase.from('user_credits').update({ balance: (data?.balance ?? 0) + 1500 }).eq('user_id', pact.user1_id)),
        supabase.from('user_credits').select('balance').eq('user_id', pact.user2_id).single()
          .then(({ data }) => supabase.from('user_credits').update({ balance: (data?.balance ?? 0) + 1500 }).eq('user_id', pact.user2_id)),
      ]);
      await supabase.from('date_pacts').update({ status: 'settled_success', settled_at: new Date().toISOString() }).eq('match_id', matchId);
      await supabase.from('messages').insert({ match_id: matchId, sender_user_id: userId, body: '✨ Date confirmed by both. Pact settled — your $15 has been returned. This is how it starts.' });
      setStatus('settled_success');
    } else if (iFlaked && theyFlaked) {
      // Both flaked: $10 each to BetterMate, $5 back to each
      await Promise.all([
        supabase.from('user_credits').select('balance').eq('user_id', pact.user1_id).single()
          .then(({ data }) => supabase.from('user_credits').update({ balance: (data?.balance ?? 0) + 500 }).eq('user_id', pact.user1_id)),
        supabase.from('user_credits').select('balance').eq('user_id', pact.user2_id).single()
          .then(({ data }) => supabase.from('user_credits').update({ balance: (data?.balance ?? 0) + 500 }).eq('user_id', pact.user2_id)),
        supabase.from('bettermate_revenue').insert({ match_id: matchId, amount_cents: 2000, reason: 'both_flaked' }),
      ]);
      await supabase.from('date_pacts').update({ status: 'settled_flake', settled_at: new Date().toISOString() }).eq('match_id', matchId);
      setStatus('settled_flake');
    } else if (iFlaked) {
      // I flaked: $10 to them, $5 to BetterMate
      const theirId = isU1 ? pact.user2_id : pact.user1_id;
      await Promise.all([
        supabase.from('user_credits').select('balance').eq('user_id', theirId).single()
          .then(({ data }) => supabase.from('user_credits').update({ balance: (data?.balance ?? 0) + 1000 }).eq('user_id', theirId)),
        supabase.from('bettermate_revenue').insert({ match_id: matchId, amount_cents: 500, reason: 'flake_fee' }),
      ]);
      await supabase.from('date_pacts').update({ status: 'settled_flake', settled_at: new Date().toISOString() }).eq('match_id', matchId);
      setStatus('settled_flake');
    }

    await trackEvent('date_pact_confirmed', { showed }, matchId);
    setActing(false);
  }

  if (loading) return null;

  return (
    <div style={{ borderBottom: '1px solid ' + BORDER }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '100%', padding: '13px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🤝</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: status === 'settled_success' ? SUCCESS : status === 'active' ? GOLD : TEXT2 }}>
              Date Pact
              {status === 'active' && timeLeft && <span style={{ fontSize: 11, color: MUTED, marginLeft: 8 }}>⏱ {timeLeft}</span>}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {status === 'none' && 'Commit $15 to meet in 7 days'}
              {status === 'pending_deposit' && 'Your $15 deposit needed to activate'}
              {status === 'waiting' && 'Waiting for their $15 deposit'}
              {status === 'active' && 'Pact active — confirm your date when ready'}
              {status === 'confirming' && 'Did you go on the date?'}
              {status === 'settled_success' && '$15 returned — pact complete'}
              {status === 'settled_flake' && 'Pact settled'}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '20px', background: SURFACE }}>

          {/* NONE — explain and prompt */}
          {status === 'none' && (
            <div>
              <div style={{ padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER, marginBottom: 16 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: TEXT, lineHeight: 1.7 }}>
                  A Date Pact holds you both accountable. Each person deposits <strong style={{ color: GOLD }}>$15</strong> from their Bond Wallet. You have <strong style={{ color: GOLD }}>7 days</strong> to meet in person.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: TEXT2 }}>
                  {[
                    { icon: '✅', text: 'Both show up → both get $15 back' },
                    { icon: '👻', text: 'One person flakes → they lose $15 ($10 to you, $5 to BetterMate)' },
                    { icon: '❌', text: 'Both flake → each loses $10 to BetterMate, $5 returned' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                      <span>{item.icon}</span><span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
                Your wallet balance: <span style={{ color: GOLD }}>${(balance / 100).toFixed(2)}</span>
                {balance < 1500 && <span style={{ color: ERROR, marginLeft: 8 }}>— need $15 minimum</span>}
              </div>
              <button onClick={deposit} disabled={balance < 1500 || acting}
                style={{ width: '100%', padding: '13px', background: balance >= 1500 ? BRAND : ELEVATED, border: 'none', borderRadius: 10, color: balance >= 1500 ? '#fff' : MUTED, fontSize: 14, fontWeight: 600, cursor: balance >= 1500 ? 'pointer' : 'not-allowed' }}>
                {acting ? 'Depositing...' : 'Deposit $15 — Start Pact'}
              </button>
            </div>
          )}

          {/* PENDING DEPOSIT */}
          {status === 'pending_deposit' && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>They have already deposited. Add your $15 to activate the 7-day countdown.</p>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
                Wallet: <span style={{ color: GOLD }}>${(balance / 100).toFixed(2)}</span>
                {balance < 1500 && <span style={{ color: ERROR, marginLeft: 8 }}>— need $15</span>}
              </div>
              <button onClick={deposit} disabled={balance < 1500 || acting}
                style={{ width: '100%', padding: '13px', background: balance >= 1500 ? BRAND : ELEVATED, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {acting ? 'Depositing...' : 'Deposit $15 — Activate Pact'}
              </button>
            </div>
          )}

          {/* WAITING */}
          {status === 'waiting' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
              <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>Your $15 is in. Waiting for them to deposit their $15 to start the countdown.</p>
            </div>
          )}

          {/* ACTIVE */}
          {status === 'active' && (
            <div>
              <div style={{ padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid rgba(201,169,110,0.3)', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⏱</div>
                <div style={{ fontSize: 22, fontWeight: 300, color: GOLD, marginBottom: 4 }}>{timeLeft}</div>
                <div style={{ fontSize: 12, color: MUTED }}>to go on your date</div>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>When you have gone on your date, confirm it here. Both of you need to confirm.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => confirmDate(true)} disabled={acting}
                  style={{ flex: 1, padding: '12px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ We went on our date
                </button>
                <button onClick={() => confirmDate(false)} disabled={acting}
                  style={{ flex: 1, padding: '12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 13, cursor: 'pointer' }}>
                  I did not show
                </button>
              </div>
            </div>
          )}

          {/* SETTLED SUCCESS */}
          {status === 'settled_success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
              <p style={{ margin: 0, fontSize: 14, color: SUCCESS, fontWeight: 600 }}>Pact complete. $15 returned to both wallets.</p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: MUTED }}>This is what intention looks like.</p>
            </div>
          )}

          {/* SETTLED FLAKE */}
          {status === 'settled_flake' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💔</div>
              <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>Pact settled. Credits have been distributed per the agreement.</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
