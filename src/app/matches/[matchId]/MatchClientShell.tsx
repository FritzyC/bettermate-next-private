'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import CompatibilitySnapshot from '@/components/CompatibilitySnapshot';

export default function MatchClientShell({ params }: { params: { matchId: string } }) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { router.replace('/auth'); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth'); return; }
      setUserId(session.user.id);

      supabase
        .from('messages')
        .select('*')
        .eq('match_id', params.matchId)
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data) setMessages(data);
          setLoading(false);
        });

      const channel = supabase
        .channel(`match-${params.matchId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${params.matchId}`,
        }, (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [router, params.matchId]);

  async function sendMessage() {
    const supabase = getSupabase();
    if (!supabase || !newMessage.trim() || !userId) return;
    const { error } = await supabase.from('messages').insert({
      match_id: params.matchId,
      sender_user_id: userId,
      body: newMessage.trim(),
    });
    if (!error) setNewMessage('');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', fontFamily: 'system-ui' }}>
        Loading chat...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/matches" style={{ color: '#888', textDecoration: 'none' }}>← Back</a>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Match #{params.matchId.slice(0, 8)}</h1>
      </div>

      <CompatibilitySnapshot matchId={params.matchId} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 ? (
          <p style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={{
              alignSelf: msg.sender_user_id === userId ? 'flex-end' : 'flex-start',
              background: msg.sender_user_id === userId ? '#6366f1' : '#1a1a1a',
              padding: '10px 16px',
              borderRadius: 12,
              maxWidth: '70%',
            }}>
              <p style={{ margin: 0, fontSize: 15 }}>{msg.body}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.6 }}>
                {new Date(msg.created_at).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '16px 24px', borderTop: '1px solid #222', display: 'flex', gap: 12 }}>
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '12px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', fontSize: 15 }}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          style={{ padding: '12px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
