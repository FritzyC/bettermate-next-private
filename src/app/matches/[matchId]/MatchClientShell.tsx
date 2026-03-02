'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';
import CompatibilitySnapshot from '@/components/CompatibilitySnapshot';
import ExpressionStore from '@/components/ExpressionStore';
import BondWallet from '@/components/BondWallet';
import ExpressionSuggester from '@/components/ExpressionSuggester';

const COACHING_PROMPTS = [
  { icon: '💬', label: 'Go deeper', message: 'What is something you have been thinking about lately that most people never ask you about?', why: 'Opens a door most people never think to knock on.' },
  { icon: '🌊', label: 'Share a win', message: 'Something small but real happened today that I want to tell you about.', why: 'Sharing small wins builds intimacy faster than big ones.' },
  { icon: '🎯', label: 'Be specific', message: 'I noticed something about the way you think and I keep coming back to it.', why: 'Specific attention is rare. It lands differently.' },
  { icon: '🌙', label: 'Go honest', message: 'Can I tell you something I do not usually say this early?', why: 'Vulnerability is the fastest path to real connection.' },
  { icon: '🔑', label: 'Flip the script', message: 'What do you wish more people understood about you?', why: 'This question makes people feel truly seen.' },
  { icon: '🌱', label: 'Future-pull', message: 'I am curious what you are working on becoming right now - not doing, becoming.', why: 'Growth questions reveal character.' },
];

export default function MatchClientShell({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [coachingHint, setCoachingHint] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabase();
    trackEvent('match_opened', {}, matchId);
    if (!supabase) { router.replace('/auth'); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth'); return; }
      setUserId(session.user.id);

      supabase.from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          setMessages(data ?? []);
          setLoading(false);
        });

      const channel = supabase
        .channel('messages:' + matchId)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: 'match_id=eq.' + matchId,
        }, (payload) => { setMessages((prev) => [...prev, payload.new]); })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [matchId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const body = (text ?? newMessage).trim();
    const supabase = getSupabase();
    if (!supabase || !body || !userId) return;
    await trackEvent('message_sent', { length: body.length }, matchId);
    await supabase.from('messages').insert({ match_id: matchId, sender_user_id: userId, body });
    setNewMessage('');
    setShowCoaching(false);
    setCoachingHint(null);
  }

  function selectPrompt(prompt: typeof COACHING_PROMPTS[0]) {
    setNewMessage(prompt.message);
    setCoachingHint(prompt.why);
    setShowCoaching(false);
  }

  async function handleUseExpression(expr: any) {
    setShowStore(false);
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const { data } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single();
    if (!data || data.balance < expr.credit_cost) return;
    await supabase.from('user_credits').update({ balance: data.balance - expr.credit_cost, updated_at: new Date().toISOString() }).eq('user_id', userId);
    await supabase.from('messages').insert({ match_id: matchId, sender_user_id: userId, body: expr.emoji + ' ' + expr.label });
    trackEvent('message_sent', { type: 'expression', id: expr.id }, matchId);
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#08041a', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>✨</div>
        <div style={{ fontSize: 13, color: '#6a5a8a' }}>Opening your space...</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#08041a', color: '#fff', fontFamily: 'system-ui' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1634', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0514', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/matches" style={{ color: '#7a6a9a', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>←</a>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8d8f8' }}>Match #{matchId ? String(matchId).slice(0, 8) : '...'}</div>
            <div style={{ fontSize: 11, color: '#4a3a6a' }}>Private space</div>
          </div>
        </div>
        <button onClick={() => setShowSnapshot(!showSnapshot)}
          style={{ background: showSnapshot ? 'rgba(192,132,252,0.15)' : 'transparent', border: '1px solid ' + (showSnapshot ? '#a78bfa' : '#2a1f45'), borderRadius: 20, padding: '6px 14px', color: showSnapshot ? '#c084fc' : '#6a5a8a', fontSize: 12, cursor: 'pointer' }}>
          {showSnapshot ? 'Hide' : '◈ Why this works'}
        </button>
      </div>

      {/* Snapshot */}
      {showSnapshot && (
        <div style={{ padding: '16px 16px 0', flexShrink: 0, maxHeight: '45vh', overflowY: 'auto' }}>
          <CompatibilitySnapshot matchId={matchId} />
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✨</div>
            <p style={{ color: '#6a5a8a', fontSize: 14, lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>
              This is your space. Say something real.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_user_id === userId;
            return (
              <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <div style={{
                  background: isMe ? 'linear-gradient(135deg, #7c3aed, #be185d)' : '#1e1a2e',
                  padding: '11px 16px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  border: isMe ? 'none' : '1px solid #2a2048',
                }}>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#ffffff' }}>{msg.body}</p>
                  <p style={{ margin: '5px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: isMe ? 'right' : 'left' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Coaching Panel */}
      {showCoaching && (
        <div style={{ padding: '16px', background: '#0a0514', borderTop: '1px solid #1e1634', flexShrink: 0 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: '#4a3a6a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Spark something real</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COACHING_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => selectPrompt(p)}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1634', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: '#a78bfa', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.label}</div>
                  <div style={{ fontSize: 13, color: '#9a8ab8', lineHeight: 1.5 }}>{p.message}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coaching hint */}
      {coachingHint && newMessage && (
        <div style={{ padding: '8px 16px', background: 'rgba(167,139,250,0.08)', borderTop: '1px solid rgba(167,139,250,0.15)', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#7a6a9a', fontStyle: 'italic' }}>✨ {coachingHint}</p>
        </div>
      )}

      {/* RAG Suggester */}
      <ExpressionSuggester matchId={matchId} onUse={handleUseExpression} />

      {/* Input bar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1634', background: '#0a0514', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowStore(true)}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1f45', fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🎭
          </button>
          <button onClick={() => { setShowCoaching(!showCoaching); setCoachingHint(null); }}
            style={{ width: 40, height: 40, borderRadius: 12, background: showCoaching ? 'rgba(240,171,202,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (showCoaching ? '#f0abca' : '#2a1f45'), fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✨
          </button>
          <input value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); if (!e.target.value) setCoachingHint(null); }}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Say something real..."
            style={{ flex: 1, padding: '11px 16px', background: '#1a1030', border: '1px solid #2a1f45', borderRadius: 20, color: '#e8d8f8', fontSize: 15, outline: 'none' }} />
          <button onClick={() => sendMessage()} disabled={!newMessage.trim()}
            style={{ width: 40, height: 40, borderRadius: 12, background: newMessage.trim() ? 'linear-gradient(135deg,#7c3aed,#be185d)' : '#1a1030', border: 'none', color: '#fff', fontSize: 18, cursor: newMessage.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ↑
          </button>
        </div>
      </div>

      {showStore && <ExpressionStore onClose={() => setShowStore(false)} onUse={handleUseExpression} onOpenWallet={() => { setShowStore(false); setShowWallet(true); }} />}
      {showWallet && <BondWallet onClose={() => setShowWallet(false)} />}
    </div>
  );
}
