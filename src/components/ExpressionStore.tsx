'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Expression = { id: string; emoji: string; label: string; subtext: string | null; tier: string; credit_cost: number; category: string };

function centsLabel(credits: number) {
  const cents = credits;
  if (cents < 100) return cents + '¢';
  return '$' + (cents / 100).toFixed(2);
}

export default function ExpressionStore({ onClose, onUse, onOpenWallet }: {
  onClose: () => void;
  onUse: (expr: Expression) => void;
  onOpenWallet: () => void;
}) {
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [balance, setBalance] = useState(0);
  const [insufficient, setInsufficient] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [{ data: catalog }, { data: credits }] = await Promise.all([
        supabase.from('expression_catalog').select('*').order('credit_cost'),
        supabase.from('user_credits').select('balance').eq('user_id', session.user.id).single(),
      ]);
      setExpressions(catalog ?? []);
      setBalance(credits?.balance ?? 0);
    }
    load();
  }, []);

  async function useExpression(expr: Expression) {
    if (balance < expr.credit_cost) {
      setInsufficient(expr.id);
      setTimeout(() => setInsufficient(null), 2000);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('user_credits')
      .update({ balance: balance - expr.credit_cost, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id);
    setBalance((prev) => prev - expr.credit_cost);
    onUse(expr);
  }

  const categoryOrder = ['vibe', 'intimate', 'deep', 'premium'];
  const categoryLabels: Record<string, string> = {
    vibe: 'Vibes',
    intimate: 'Intimate',
    deep: 'Deep',
    premium: 'Premium',
  };
  const grouped = categoryOrder.map(cat => ({
    cat,
    items: expressions.filter(e => e.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,4,26,0.97)', zIndex: 100, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1634', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0514' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8d8f8' }}>Expressions</div>
          <button onClick={onOpenWallet} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: '#a78bfa', marginTop: 2, display: 'block' }}>
            💳 {(balance / 100).toFixed(2)} credit balance
          </button>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a3a6a', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {grouped.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <p style={{ margin: '0 0 12px', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2e2248' }}>{categoryLabels[cat]}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {items.map(expr => {
                const cantAfford = balance < expr.credit_cost;
                const isInsufficient = insufficient === expr.id;
                return (
                  <button key={expr.id} onClick={() => useExpression(expr)}
                    style={{ background: isInsufficient ? 'rgba(190,24,93,0.15)' : expr.category === 'premium' ? 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(190,24,93,0.15))' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (isInsufficient ? '#be185d' : expr.category === 'premium' ? '#7c3aed44' : '#1e1634'), borderRadius: 14, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', opacity: cantAfford ? 0.6 : 1 }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{expr.emoji}</div>
                    <div style={{ fontSize: 13, color: '#c8b8e8', marginBottom: 4, fontWeight: 500 }}>{expr.label}</div>
                    {expr.subtext && <div style={{ fontSize: 11, color: '#4a3a6a', lineHeight: 1.4, marginBottom: 8 }}>{expr.subtext}</div>}
                    <div style={{ fontSize: 12, color: isInsufficient ? '#be185d' : expr.category === 'premium' ? '#c084fc' : '#f0abca', fontWeight: 600 }}>
                      {isInsufficient ? 'Need more credits' : centsLabel(expr.credit_cost)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add credits CTA */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #1e1634', background: '#0a0514' }}>
        <button onClick={onOpenWallet} style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#7c3aed,#be185d)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          💳 Add Credits to Bond Wallet
        </button>
      </div>
    </div>
  );
}
