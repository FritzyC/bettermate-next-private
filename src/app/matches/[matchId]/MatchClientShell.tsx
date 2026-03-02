'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';
import CompatibilitySnapshot from '@/components/CompatibilitySnapshot';
import ExpressionStore from '@/components/ExpressionStore';
import BondWallet from '@/components/BondWallet';
import ExpressionSuggester from '@/components/ExpressionSuggester';
import KineticMatchmaker from '@/components/KineticMatchmaker';

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
      supabase.from('messages').select('*').eq('match_id', matchId).order('created_at', { ascending: true })
        .then(({ data }) => { setMessages(data ?? []); setLoading(false); });
      const channel = supabase.channel('messages:' + matchId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'match_id=eq.' + matchId },
          (payload) => { setMessages((prev) => [...prev, payload.new]); })
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
    <div style={{ height: '100vh', background: '#1E1035', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>✨</div>
        <div style={{ fontSize: 13, color: '#7A6A96' }}>Opening your space...</div>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', background: '#1E1035', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '14px 20px', background: '#2A1648', borderBottom: '1px solid #5a1a8a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/matches" style={{ color: '#7A6A96', textDecoration: 'none', fontSize: 20 }}>←</a>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#EDE8F5' }}>Match #{String(matchId).slice(0, 8)}</div>
            <div style={{ fontSize: 11, color: '#7A6A96' }}>Private space</div>
          </div>
        </div>
        <button onClick={() => setShowSnapshot(!showSnapshot)}
          style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid #3D2860', background: 'transparent', color: showSnapshot ? '#d080ff' : '#9a6abf', fontSize: 12, cursor: 'pointer' }}>
          {showSnapshot ? 'Hide' : '◈ Why this works'}
        </button>
      </div>

      {/* Kinetic Matchmaker */}
      {userId && <KineticMatchmaker matchId={matchId} userId={userId} />}

      {/* Snapshot overlay - does not push layout */}
      {showSnapshot && (
        <div style={{ flexShrink: 0, maxHeight: '42vh', overflowY: 'auto', background: '#1E1035', borderBottom: '1px solid #5a1a8a', padding: '16px' }}>
          <CompatibilitySnapshot matchId={matchId} />
        </div>
      )}

      {/* Messages scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
            <p style={{ color: '#7A6A96', fontSize: 14, lineHeight: 1.6 }}>This is your space. Say something real.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg) => {
              const isMe = msg.sender_user_id === userId;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '72%',
                    wordBreak: 'break-word',
                    padding: '11px 15px',
                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMe ? 'linear-gradient(135deg, #6d00cc, #a8006e)' : '#2d0a52',
                    border: isMe ? 'none' : '1px solid #5a1a8a',
                  }}>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#ffffff' }}>{msg.body}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: isMe ? 'right' : 'left' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Coaching panel */}
      {showCoaching && (
        <div style={{ flexShrink: 0, maxHeight: '38vh', overflowY: 'auto', background: '#2A1648', borderTop: '1px solid #5a1a8a', padding: '14px 16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 10, color: '#7A6A96', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Spark something real</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COACHING_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => { setNewMessage(p.message); setCoachingHint(p.why); setShowCoaching(false); }}
                style={{ background: '#342058', border: '1px solid #3D2860', borderRadius: 10, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: '#8452B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{p.label}</div>
                  <div style={{ fontSize: 13, color: '#B8A8D4', lineHeight: 1.5 }}>{p.message}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coaching hint */}
      {coachingHint && newMessage && (
        <div style={{ flexShrink: 0, padding: '7px 16px', background: 'rgba(100,0,200,0.18)', borderTop: '1px solid rgba(160,80,255,0.2)' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#7A6A96', fontStyle: 'italic' }}>✨ {coachingHint}</p>
        </div>
      )}

      {/* RAG Suggester */}
      <ExpressionSuggester matchId={matchId} onUse={handleUseExpression} />

      {/* Input bar */}
      <div style={{ flexShrink: 0, padding: '11px 14px', background: '#2A1648', borderTop: '1px solid #5a1a8a' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowStore(true)}
            style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: '#342058', border: '1px solid #3D2860', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🎭
          </button>
          <button onClick={() => { setShowCoaching(!showCoaching); setCoachingHint(null); }}
            style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: showCoaching ? 'rgba(160,80,255,0.25)' : '#2d0a52', border: '1px solid #3D2860', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✨
          </button>
          <input value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); if (!e.target.value) setCoachingHint(null); }}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Say something real..."
            style={{ flex: 1, padding: '11px 16px', background: '#342058', border: '1px solid #3D2860', borderRadius: 20, color: '#EDE8F5', fontSize: 15, outline: 'none' }} />
          <button onClick={() => sendMessage()} disabled={!newMessage.trim()}
            style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: 'none', fontSize: 18, cursor: newMessage.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: newMessage.trim() ? 'linear-gradient(135deg,#7B1C4A,#4A0F2E)' : '#2d0a52' }}>
            ↑
          </button>
        </div>
      </div>

      {showStore && <ExpressionStore onClose={() => setShowStore(false)} onUse={handleUseExpression} onOpenWallet={() => { setShowStore(false); setShowWallet(true); }} />}
      {showWallet && <BondWallet onClose={() => setShowWallet(false)} />}
    </div>
  );
}
