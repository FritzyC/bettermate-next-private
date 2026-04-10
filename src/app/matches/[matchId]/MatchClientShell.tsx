'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';
import CompatibilitySnapshot from '@/components/CompatibilitySnapshot';
import ExpressionStore from '@/components/ExpressionStore';
import BondWallet from '@/components/BondWallet';
import ExpressionSuggester from '@/components/ExpressionSuggester';
import VibeDrawer from '@/components/VibeDrawer';
import BlindChat, { isQualifying } from '@/components/BlindChat';
import DatePlan from '@/components/DatePlan';
import CommitmentBond from '@/components/CommitmentBond';
import SpotifySongShare from '@/components/SpotifySongShare';

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
  const [planStatus, setPlanStatus] = useState<string>('');
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [vibeOpen, setVibeOpen] = useState(false);
  const [blindRevealed, setBlindRevealed] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [coachingHint, setCoachingHint] = useState<string | null>(null);
  const [showDatePlan, setShowDatePlan] = useState(false);
  const [matchOnHold, setMatchOnHold] = useState(false);
  const [meetDeadline, setMeetDeadline] = useState<string | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [withinRange, setWithinRange] = useState<boolean | null>(null);
  const [showSpotify, setShowSpotify] = useState(false);
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
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!s) return;
        fetch('/api/match/distance?matchId=' + matchId + '&userId=' + s.user.id, { headers: { 'Authorization': 'Bearer ' + s.access_token } })
          .then(r => r.json()).then(d => { if (d.ok && d.coords_available) { setDistanceMiles(d.distance_miles); setWithinRange(d.within_50); } }).catch(() => {});
      });
      supabase.from('matches').select('blind_revealed,meet_deadline,status,on_hold_at').eq('id', matchId).single()
        .then(({ data }) => {
          if (data?.blind_revealed) setBlindRevealed(true);
          if (data?.meet_deadline) setMeetDeadline(data.meet_deadline);
          if (data?.on_hold_at || (data?.meet_deadline && new Date(data.meet_deadline) < new Date() && data?.status !== 'completed_checked_in')) {
            setMatchOnHold(true);
          }
        });
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
    if (userId && !blindRevealed && isQualifying(newMessage)) {
      const { data: matchData } = await supabase.from('matches').select('*').eq('id', matchId).single();
      if (matchData && !matchData.blind_revealed) {
        const isUser1 = matchData.user_a_id === userId;
        const field = isUser1 ? 'user1_qualifying_msgs' : 'user2_qualifying_msgs';
        const currentCount = isUser1 ? matchData.user1_qualifying_msgs : matchData.user2_qualifying_msgs;
        if (currentCount < 6) {
          await supabase.from('matches').update({ [field]: currentCount + 1 }).eq('id', matchId);
        }
      }
    }

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

      {/* On Hold Banner */}
      {matchOnHold && (
        <div style={{ flexShrink: 0, background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 0, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A96E', marginBottom: 2 }}>This connection is on hold.</div>
            <div style={{ fontSize: 11, color: '#7A6A96', lineHeight: 1.5 }}>
              {meetDeadline
                ? 'The 168-hour meet window has passed.'
                : 'This match is currently paused.'}
              {' '}Reactivate to continue.
            </div>
          </div>
          <a href={'/payments/reactivate?matchId=' + matchId}
            style={{ flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'Georgia, serif' }}>
            Reactivate — $4.99
          </a>
        </div>
      )}

      {/* Extended Chat Banner — shown when > 50 miles and revealed */}
      {blindRevealed && withinRange === false && !matchOnHold && (
        <div style={{ flexShrink: 0, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', marginBottom: 2 }}>
              {distanceMiles ? distanceMiles + ' miles apart' : 'Long distance connection'}
            </div>
            <div style={{ fontSize: 11, color: '#7A6A96', lineHeight: 1.5 }}>Keep the connection alive — $0.99/day</div>
          </div>
          <a href={'/payments/extend-chat?matchId=' + matchId}
            style={{ flexShrink: 0, background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'Georgia, serif' }}>
            Extend Chat
          </a>
        </div>
      )}

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '14px 20px', background: '#2A1648', borderBottom: '1px solid #5a1a8a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/matches" style={{ color: '#7A6A96', textDecoration: 'none', fontSize: 20 }}>←</a>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#EDE8F5' }}>Match #{String(matchId).slice(0, 8)}</div>
            <div style={{ fontSize: 11, color: '#7A6A96' }}>Private space</div>
          </div>
        </div>
        <button onClick={() => { setShowSnapshot(!showSnapshot); if (!showSnapshot) trackEvent('why_this_works_opened', {}, matchId); }}
          style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid #3D2860', background: 'transparent', color: showSnapshot ? '#d080ff' : '#9a6abf', fontSize: 12, cursor: 'pointer' }}>
          {showSnapshot ? 'Hide' : '◈ Why this works'}
        </button>
        <button
          onClick={() => { setVibeOpen(true); trackEvent('vibe_opened', { source: 'toolbar' }, matchId); }}
          aria-label="Open Vibe space"
          style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid #5A3A8A', background: vibeOpen ? 'rgba(132,82,184,0.25)' : 'rgba(132,82,184,0.08)', color: '#B48AE8', fontSize: 12, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.02em' }}>
          🎭 Vibe
        </button>
        <button onClick={() => setShowDatePlan(!showDatePlan)}
          style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid #3D2860', background: showDatePlan ? 'rgba(124,58,237,0.2)' : 'transparent', color: showDatePlan ? '#c084fc' : '#9a6abf', fontSize: 12, cursor: 'pointer' }}>
          📅 Plan
        </button>
        <button onClick={() => setShowSpotify(!showSpotify)}
          style={{ padding: '7px 14px', borderRadius: 20, border: '2px solid #1DB954', background: showSpotify ? '#1DB954' : 'rgba(29,185,84,0.15)', color: showSpotify ? '#000' : '#1DB954', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          🎵 Share a Song
        </button>
      </div>








      {/* Vibe Drawer */}
      {userId && vibeOpen && (
        <VibeDrawer
          open={vibeOpen}
          onClose={() => { setVibeOpen(false); trackEvent('vibe_closed', {}, matchId); }}
          matchId={matchId}
          userId={userId}
        />
      )}

      {userId && (
        <div style={{ padding: '8px 16px 0' }}>
          <BlindChat matchId={matchId} userId={userId} onReveal={() => setBlindRevealed(true)} />
        </div>
      )}

      {/* Snapshot overlay - does not push layout */}
      {showSnapshot && (
        <div style={{ flexShrink: 0, maxHeight: '42vh', overflowY: 'auto', background: '#1E1035', borderBottom: '1px solid #5a1a8a', padding: '16px' }}>
          <CompatibilitySnapshot matchId={matchId} />
        </div>
      )}

      {/* Date Planning Prompt — shown after reveal when no plan started */}
      {blindRevealed && planStatus === '' && (
        <div style={{ flexShrink:0, background:'linear-gradient(135deg,rgba(201,169,110,0.1),rgba(124,58,237,0.08))', border:'1px solid rgba(201,169,110,0.3)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#C9A96E', fontFamily:'Georgia,serif', marginBottom:3 }}>Your 72-hour date window is open.</div>
            <div style={{ fontSize:11, color:'rgba(201,169,110,0.6)' }}>Start your date plan now — agree on a venue and time before the window closes.</div>
          </div>
          <button onClick={() => setShowDatePlan(true)} style={{ flexShrink:0, padding:'9px 18px', background:'rgba(201,169,110,0.15)', border:'1px solid rgba(201,169,110,0.4)', borderRadius:10, color:'#C9A96E', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Georgia,serif' }}>
            Plan Date →
          </button>
        </div>
      )}

      {/* Date Plan — only visible after blind chat reveal */}
      {userId && blindRevealed && <CommitmentBond matchId={matchId} userId={userId} planStatus={planStatus} scheduledAt={null} />}
      {showDatePlan && blindRevealed && userId && (
        <div style={{ flexShrink: 0, maxHeight: '45vh', overflowY: 'auto', background: '#1E1035', borderBottom: '1px solid #5a1a8a', padding: '16px' }}>
          <DatePlan matchId={matchId} userId={userId} inline />
        </div>
      )}

      {/* Spotify Song Share */}
      {showSpotify && userId && (
        <div style={{ flexShrink: 0, maxHeight: '45vh', overflowY: 'auto', background: '#1E1035', borderBottom: '1px solid #5a1a8a', padding: '16px' }}>
          <SpotifySongShare matchId={matchId} userId={userId} />
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
                  {msg.message_type === 'song_share' && msg.metadata ? (
                    <div style={{ maxWidth:'80%', background:'#1a0a2e', border:'1px solid #1DB954', borderRadius:16, padding:'12px 16px', display:'flex', gap:12, alignItems:'center' }}>
                      {msg.metadata.album_art && <img src={msg.metadata.album_art} alt="album" style={{ width:52, height:52, borderRadius:8, flexShrink:0 }} />}
                      <div>
                        <p style={{ margin:'0 0 2px', fontSize:13, fontWeight:600, color:'#fff' }}>{msg.metadata.name || 'Song'}</p>
                        <p style={{ margin:'0 0 4px', fontSize:11, color:'#a0a0b0' }}>{msg.metadata.artist || ''}</p>
                        <p style={{ margin:'0 0 6px', fontSize:12, color:'#7A6A96', fontStyle:'italic' }}>{msg.body}</p>
                        {msg.metadata.external_url && <a href={msg.metadata.external_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#1DB954', textDecoration:'none', fontWeight:600 }}>▶ Open in Spotify</a>}
                        <p style={{ margin:'6px 0 0', fontSize:10, color:'rgba(255,255,255,0.35)' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</p>
                      </div>
                    </div>
                  ) : (
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
                  )}
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
