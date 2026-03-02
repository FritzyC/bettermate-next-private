'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';
import CompatibilitySnapshot from '@/components/CompatibilitySnapshot';

const VIBE_EXPRESSIONS = [
  { emoji: '🔥', label: 'Feeling this' },
  { emoji: '💭', label: 'Thinking of you' },
  { emoji: '😊', label: 'This made me smile' },
  { emoji: '✨', label: 'Something about you' },
  { emoji: '🎯', label: 'Real talk' },
  { emoji: '🌙', label: 'Late night thoughts' },
  { emoji: '💫', label: 'You surprise me' },
  { emoji: '🤝', label: 'I respect that' },
];

const COACHING_PROMPTS = [
  { icon: '💬', text: 'Ask them what they are building right now — most people never get asked.' },
  { icon: '🌊', text: 'Share one thing that genuinely surprised you this week. Vulnerability opens doors.' },
  { icon: '🎯', text: 'Tell them one thing you noticed about them that most people would miss.' },
  { icon: '🌙', text: 'Ask what they are looking forward to most in the next 3 months.' },
  { icon: '✨', text: 'Share a small win from today — no matter how minor. Joy is contagious.' },
  { icon: '🔑', text: 'Ask what they wish more people understood about them.' },
  { icon: '💡', text: 'Tell them one thing from your conversation you keep thinking about.' },
  { icon: '🌱', text: 'Ask what they are working on becoming — not doing, becoming.' },
];

export default function MatchClientShell({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showVibe, setShowVibe] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);
  const [sentVibe, setSentVibe] = useState<string | null>(null);
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
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'match_id=eq.' + matchId,
        }, (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [matchId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const body = text ?? newMessage.trim();
    const supabase = getSupabase();
    if (!supabase || !body || !userId) return;
    await trackEvent('message_sent', { length: body.length }, matchId);
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_user_id: userId,
      body,
    });
    if (!text) setNewMessage('');
    setShowVibe(false);
    setShowCoaching(false);
  }

  async function sendVibe(v: { emoji: string; label: string }) {
    setSentVibe(v.emoji);
    await sendMessage(v.emoji + ' ' + v.label);
    setTimeout(() => setSentVibe(null), 1500);
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#08041a', color: '#a78bfa', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>✨</div>
        <div style={{ fontSize: 14, color: '#4a3a6a' }}>Opening your space...</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#08041a', color: '#fff', fontFamily: 'system-ui', position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1634', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0514', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/matches" style={{ color: '#4a3a6a', textDecoration: 'none', fontSize: 18 }}>←</a>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8d8f8' }}>
              Match #{matchId ? String(matchId).slice(0, 8) : '...'}
            </div>
            <div style={{ fontSize: 11, color: '#4a3a6a', letterSpacing: '0.05em' }}>Private space</div>
          </div>
        </div>
        <button
          onClick={() => setShowSnapshot(!showSnapshot)}
          style={{ background: showSnapshot ? 'rgba(192,132,252,0.15)' : 'transparent', border: '1px solid ' + (showSnapshot ? '#a78bfa' : '#2a1f45'), borderRadius: 20, padding: '6px 14px', color: showSnapshot ? '#c084fc' : '#4a3a6a', fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
          {showSnapshot ? 'Hide' : '◈ Why this works'}
        </button>
      </div>

      {/* Snapshot (collapsible) */}
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
            <p style={{ color: '#2e2248', fontSize: 14, lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>
              This is your space. Say something real.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_user_id === userId;
            const isVibe = VIBE_EXPRESSIONS.some(v => msg.body?.startsWith(v.emoji));
            return (
              <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                {isVibe ? (
                  <div style={{ fontSize: 28, textAlign: isMe ? 'right' : 'left', padding: '4px 8px' }}>
                    {msg.body}
                  </div>
                ) : (
                  <div style={{
                    background: isMe
                      ? 'linear-gradient(135deg, #7c3aed, #be185d)'
                      : '#1a1030',
                    padding: '10px 16px',
                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    border: isMe ? 'none' : '1px solid #2a1f45',
                  }}>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: isMe ? '#fff' : '#c8b8e8' }}>{msg.body}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.5, textAlign: isMe ? 'right' : 'left' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Vibe Panel */}
      {showVibe && (
        <div style={{ padding: '16px', background: '#0e0a1a', borderTop: '1px solid #1e1634', flexShrink: 0 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: '#4a3a6a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Send a vibe</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {VIBE_EXPRESSIONS.map((v) => (
              <button key={v.emoji} onClick={() => sendVibe(v)}
                style={{ background: sentVibe === v.emoji ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.03)', border: '1px solid #2a1f45', borderRadius: 10, padding: '10px 6px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
                <div style={{ fontSize: 22 }}>{v.emoji}</div>
                <div style={{ fontSize: 9, color: '#6a5a8a', marginTop: 4, lineHeight: 1.2 }}>{v.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coaching Panel */}
      {showCoaching && (
        <div style={{ padding: '16px', background: '#0e0a1a', borderTop: '1px solid #1e1634', flexShrink: 0 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: '#4a3a6a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Spark something</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COACHING_PROMPTS.slice(0, 4).map((p, i) => (
              <button key={i} onClick={() => { setNewMessage(p.text); setShowCoaching(false); }}
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2a1f45', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <span style={{ fontSize: 16, marginRight: 10 }}>{p.icon}</span>
                <span style={{ fontSize: 13, color: '#9a8ab8', lineHeight: 1.5 }}>{p.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1634', background: '#0a0514', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button onClick={() => { setShowVibe(!showVibe); setShowCoaching(false); }}
            style={{ width: 40, height: 40, borderRadius: 12, background: showVibe ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (showVibe ? '#a78bfa' : '#2a1f45'), fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🎭
          </button>
          <button onClick={() => { setShowCoaching(!showCoaching); setShowVibe(false); }}
            style={{ width: 40, height: 40, borderRadius: 12, background: showCoaching ? 'rgba(240,171,202,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (showCoaching ? '#f0abca' : '#2a1f45'), fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✨
          </button>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Say something real..."
            style={{ flex: 1, padding: '11px 16px', background: '#1a1030', border: '1px solid #2a1f45', borderRadius: 20, color: '#e8d8f8', fontSize: 15, outline: 'none' }}
          />
          <button onClick={() => sendMessage()}
            disabled={!newMessage.trim()}
            style={{ width: 40, height: 40, borderRadius: 12, background: newMessage.trim() ? 'linear-gradient(135deg,#7c3aed,#be185d)' : '#1a1030', border: 'none', color: '#fff', fontSize: 18, cursor: newMessage.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
