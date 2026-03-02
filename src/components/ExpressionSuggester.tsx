'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Expression = { id: string; emoji: string; label: string; subtext: string | null; credit_cost: number; category: string };

export default function ExpressionSuggester({ matchId, onUse }: {
  matchId: string;
  onUse: (expr: Expression) => void;
}) {
  const [suggestion, setSuggestion] = useState<{ expr: Expression; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const timer = setTimeout(() => analyze(), 8000);
    return () => clearTimeout(timer);
  }, [matchId, dismissed]);

  async function analyze() {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [{ data: msgs }, { data: catalog }, { data: credits }] = await Promise.all([
      supabase.from('messages').select('body, sender_user_id').eq('match_id', matchId).order('created_at', { ascending: false }).limit(6),
      supabase.from('expression_catalog').select('*'),
      supabase.from('user_credits').select('balance').eq('user_id', session.user.id).single(),
    ]);

    setBalance(credits?.balance ?? 0);
    if (!msgs || msgs.length < 2 || !catalog) { setLoading(false); return; }

    // Call Claude API to pick the right expression
    const recentText = msgs.reverse().map((m: any) => (m.sender_user_id === session.user.id ? 'Me' : 'Them') + ': ' + m.body).join('\n');
    const catalogSummary = catalog.map((e: any) => e.id + ' | ' + e.emoji + ' ' + e.label + ' (' + e.category + ')').join('\n');

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: 'You are a warm relationship coach. Based on this conversation, pick ONE expression from the catalog that would land perfectly right now. Reply with JSON only: {"id": "expression_id", "reason": "one warm sentence explaining why this moment calls for it (max 12 words)"}\n\nConversation:\n' + recentText + '\n\nCatalog:\n' + catalogSummary,
          }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const matched = catalog.find((e: any) => e.id === parsed.id);
      if (matched) {
        setSuggestion({ expr: matched, reason: parsed.reason });
      }
    } catch (_) {}

    setLoading(false);
  }

  if (dismissed || (!loading && !suggestion)) return null;

  if (loading) return (
    <div style={{ margin: '0 16px 12px', padding: '10px 14px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: 'pulse 1.5s infinite' }} />
      <span style={{ fontSize: 12, color: '#4a3a6a', fontStyle: 'italic' }}>Reading the moment...</span>
    </div>
  );

  if (!suggestion) return null;

  const canAfford = balance >= suggestion.expr.credit_cost;

  return (
    <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 14, position: 'relative' }}>
      <button onClick={() => setDismissed(true)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: '#2e2248', fontSize: 14, cursor: 'pointer' }}>✕</button>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4a3a6a', marginBottom: 8 }}>✨ This moment calls for</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 28 }}>{suggestion.expr.emoji}</span>
        <div>
          <div style={{ fontSize: 14, color: '#e8d8f8', fontWeight: 500, marginBottom: 2 }}>{suggestion.expr.label}</div>
          {suggestion.expr.subtext && <div style={{ fontSize: 12, color: '#4a3a6a' }}>{suggestion.expr.subtext}</div>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#6a5a8a', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>
        {suggestion.reason}
      </div>
      <button onClick={() => canAfford ? onUse(suggestion.expr) : null}
        style={{ width: '100%', padding: '10px', background: canAfford ? 'linear-gradient(135deg,#7c3aed,#be185d)' : '#1a1030', border: canAfford ? 'none' : '1px solid #2a1f45', borderRadius: 10, color: canAfford ? '#fff' : '#4a3a6a', fontSize: 13, fontWeight: 600, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
        {canAfford ? 'Send ' + suggestion.expr.emoji + ' · ' + suggestion.expr.credit_cost + ' credits' : 'Need ' + suggestion.expr.credit_cost + ' credits · Add to wallet'}
      </button>
    </div>
  );
}
