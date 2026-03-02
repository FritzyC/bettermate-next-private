'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Pack = { id: string; name: string; credits: number; price_cents: number; bonus_credits: number };
type Expression = { id: string; emoji: string; label: string; subtext: string | null; tier: string; credit_cost: number; category: string };

export default function ExpressionStore({ onClose, onBuy }: { onClose: () => void; onBuy: (expr: Expression) => void }) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [balance, setBalance] = useState(0);
  const [tab, setTab] = useState<'expressions' | 'packs'>('expressions');
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [{ data: catalog }, { data: packData }, { data: credits }] = await Promise.all([
        supabase.from('expression_catalog').select('*').order('credit_cost'),
        supabase.from('credit_packs').select('*').order('price_cents'),
        supabase.from('user_credits').select('balance').eq('user_id', session.user.id).single(),
      ]);

      setExpressions(catalog ?? []);
      setPacks(packData ?? []);
      setBalance(credits?.balance ?? 0);
    }
    load();
  }, []);

  async function buyPack(pack: Pack) {
    setPurchasing(pack.id);
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const total = pack.credits + pack.bonus_credits;
    const { data: existing } = await supabase.from('user_credits').select('balance').eq('user_id', session.user.id).single();
    if (existing) {
      await supabase.from('user_credits').update({ balance: existing.balance + total, updated_at: new Date().toISOString() }).eq('user_id', session.user.id);
    } else {
      await supabase.from('user_credits').insert({ user_id: session.user.id, balance: total });
    }
    setBalance((prev) => prev + total);
    setPurchasing(null);
  }

  async function useExpression(expr: Expression) {
    if (expr.tier === 'free') { onBuy(expr); return; }
    if (balance < expr.credit_cost) { setTab('packs'); return; }
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('user_credits').update({ balance: balance - expr.credit_cost, updated_at: new Date().toISOString() }).eq('user_id', session.user.id);
    setBalance((prev) => prev - expr.credit_cost);
    onBuy(expr);
  }

  const categoryOrder = ['vibe', 'intimate', 'deep', 'premium'];
  const grouped = categoryOrder.map(cat => ({
    cat,
    items: expressions.filter(e => e.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,4,26,0.95)', zIndex: 100, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1634', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0514' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8d8f8' }}>Expression Store</div>
          <div style={{ fontSize: 11, color: '#4a3a6a', marginTop: 2 }}>{balance} credits available</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a3a6a', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1e1634', background: '#0a0514' }}>
        {(['expressions', 'packs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent', color: tab === t ? '#a78bfa' : '#4a3a6a', fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t === 'expressions' ? '✨ Expressions' : '💎 Credit Packs'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {tab === 'expressions' && grouped.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <p style={{ margin: '0 0 12px', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2e2248' }}>{cat}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {items.map(expr => (
                <button key={expr.id} onClick={() => useExpression(expr)}
                  style={{ background: expr.tier === 'premium' ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(190,24,93,0.15))' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (expr.tier === 'premium' ? '#7c3aed44' : '#1e1634'), borderRadius: 14, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{expr.emoji}</div>
                  <div style={{ fontSize: 13, color: '#c8b8e8', marginBottom: 4, fontWeight: 500 }}>{expr.label}</div>
                  {expr.subtext && <div style={{ fontSize: 11, color: '#4a3a6a', lineHeight: 1.4, marginBottom: 8 }}>{expr.subtext}</div>}
                  <div style={{ fontSize: 11, color: expr.tier === 'free' ? '#6ecfae' : expr.credit_cost >= 99 ? '#c084fc' : '#f0abca' }}>
                    {expr.tier === 'free' ? 'Free' : expr.credit_cost + ' credits'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {tab === 'packs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4a3a6a', lineHeight: 1.6 }}>
              Credits never expire. Use them on any expression, anytime.
            </p>
            {packs.map(pack => (
              <div key={pack.id} style={{ background: pack.id === 'popular' ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(190,24,93,0.12))' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (pack.id === 'popular' ? '#7c3aed55' : '#1e1634'), borderRadius: 16, padding: '20px', position: 'relative' }}>
                {pack.id === 'popular' && <div style={{ position: 'absolute', top: -10, right: 16, background: 'linear-gradient(135deg,#7c3aed,#be185d)', borderRadius: 20, padding: '3px 12px', fontSize: 10, color: '#fff', fontWeight: 600, letterSpacing: '0.05em' }}>MOST POPULAR</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#e8d8f8', marginBottom: 4 }}>{pack.name}</div>
                    <div style={{ fontSize: 13, color: '#7a6a9a' }}>
                      {pack.credits} credits{pack.bonus_credits > 0 ? ' + ' + pack.bonus_credits + ' bonus' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 300, color: '#e8d8f8' }}>
                    ${(pack.price_cents / 100).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => buyPack(pack)} disabled={purchasing === pack.id}
                  style={{ width: '100%', padding: '12px', background: pack.id === 'popular' ? 'linear-gradient(135deg,#7c3aed,#be185d)' : 'rgba(167,139,250,0.15)', border: pack.id === 'popular' ? 'none' : '1px solid #a78bfa44', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {purchasing === pack.id ? 'Adding...' : 'Get ' + (pack.credits + pack.bonus_credits) + ' Credits'}
                </button>
              </div>
            ))}
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#2e2248', textAlign: 'center', lineHeight: 1.5 }}>
              Stripe payment coming soon. Credits added instantly for testing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
