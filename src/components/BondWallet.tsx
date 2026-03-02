'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

export default function BondWallet({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const PRESETS = [10, 25, 50, 100];

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', session.user.id)
        .single();
      setBalance(data?.balance ?? 0);
    }
    load();
  }, []);

  async function topUp(dollars: number) {
    if (dollars < 5) return;
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const credits = dollars * 100; // $1 = 100 credits, 1 credit = $0.01, expressions cost 25-99 credits
    const { data: existing } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', session.user.id)
      .single();

    if (existing) {
      await supabase.from('user_credits')
        .update({ balance: existing.balance + credits, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);
      setBalance(existing.balance + credits);
    } else {
      await supabase.from('user_credits')
        .insert({ user_id: session.user.id, balance: credits });
      setBalance(credits);
    }

    setLoading(false);
    setSuccess(true);
    setAmount('');
    setTimeout(() => setSuccess(false), 2000);
  }

  function formatBalance(credits: number) {
    return (credits / 100).toFixed(2);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,4,26,0.97)', zIndex: 200, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
      
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1634', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0514' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8d8f8' }}>Bond Wallet</div>
          <div style={{ fontSize: 11, color: '#4a3a6a', marginTop: 2 }}>Your expression credits</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a3a6a', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>

        {/* Balance card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(190,24,93,0.2))', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, padding: '28px 24px', marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#6a5a8a', textTransform: 'uppercase', marginBottom: 8 }}>Available Balance</div>
          <div style={{ fontSize: 44, fontWeight: 300, color: '#e8d8f8', letterSpacing: '-0.03em', lineHeight: 1 }}>
            ${balance !== null ? formatBalance(balance) : '--'}
          </div>
          <div style={{ fontSize: 12, color: '#4a3a6a', marginTop: 8 }}>
            {balance !== null ? balance + ' credits' : ''}
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 16px', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2e2248' }}>How credits work</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '💳', text: '$1 = 100 credits' },
              { icon: '✨', text: 'Expressions cost 25–99 credits each' },
              { icon: '🔥', text: 'Credits deduct instantly when you express' },
              { icon: '💎', text: 'Credits never expire' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid #1e1634' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: '#7a6a9a' }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top up */}
        <p style={{ margin: '0 0 14px', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2e2248' }}>Add credits</p>

        {/* Preset amounts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ padding: '14px 8px', background: amount === String(p) ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (amount === String(p) ? '#a78bfa' : '#1e1634'), borderRadius: 12, color: amount === String(p) ? '#e8d8f8' : '#6a5a8a', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>${p}</div>
              <div style={{ fontSize: 10, color: '#4a3a6a', marginTop: 2 }}>{p * 100} cr</div>
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#1a1030', border: '1px solid #2a1f45', borderRadius: 14, overflow: 'hidden' }}>
            <span style={{ padding: '0 14px', fontSize: 18, color: '#4a3a6a' }}>$</span>
            <input
              type="number"
              min="5"
              placeholder="Custom amount (min $5)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ flex: 1, padding: '14px 0', background: 'none', border: 'none', color: '#e8d8f8', fontSize: 16, outline: 'none' }}
            />
          </div>
          {amount && Number(amount) < 5 && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#be185d' }}>Minimum top-up is $5</p>
          )}
        </div>

        {/* Add button */}
        <button
          onClick={() => topUp(Number(amount))}
          disabled={!amount || Number(amount) < 5 || loading}
          style={{ width: '100%', padding: '16px', background: amount && Number(amount) >= 5 ? 'linear-gradient(135deg,#7c3aed,#be185d)' : '#1a1030', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 600, cursor: amount && Number(amount) >= 5 ? 'pointer' : 'not-allowed', transition: 'all 0.2s', marginBottom: 12 }}>
          {loading ? 'Adding...' : success ? '✓ Added!' : amount && Number(amount) >= 5 ? 'Add $' + amount + ' (' + (Number(amount) * 100) + ' credits)' : 'Select an amount'}
        </button>

        <p style={{ margin: 0, fontSize: 11, color: '#2e2248', textAlign: 'center', lineHeight: 1.6 }}>
          Stripe payment integration coming soon. Credits added instantly for testing.
        </p>
      </div>
    </div>
  );
}
