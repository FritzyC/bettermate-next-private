'use client';

import React, { useEffect, useState } from 'react';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import NotificationBell from '@/components/NotificationBell';

export default function MatchesClientShell() {
  useOnboardingGuard();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = React.useRef<string | null>(null);
  const [otherUsers, setOtherUsers] = useState<Record<string, { photos: string[]; name: string }>>({});

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb) { router.replace('/auth?next=/matches'); return; }
      let { data: { session } } = await sb.auth.getSession();
      if (!session && typeof window !== 'undefined') {
        const lsKey = Object.keys(localStorage).find(k => k.includes('auth-token'));
        if (lsKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(lsKey) ?? '{}');
            const token = parsed?.access_token ?? parsed?.session?.access_token;
            const refresh = parsed?.refresh_token ?? parsed?.session?.refresh_token ?? '';
            if (token) {
              const { data } = await sb.auth.setSession({ access_token: token, refresh_token: refresh });
              session = data.session;
            }
          } catch {}
        }
      }
      // Final fallback — try getUser with current token
      if (!session) {
        const { data: { user: u } } = await sb.auth.getUser();
        if (u) {
          const { data: { session: s2 } } = await sb.auth.getSession();
          session = s2;
        }
      }
      const user = session?.user ?? null;
      if (!user) { router.replace('/auth?next=/matches'); return; }
      setUserEmail(user.email ?? null);
      setUserId(user.id);
      userIdRef.current = user.id;

      const { data: ufp } = await sb.from('user_fingerprint').select('display_name').eq('id', user.id).maybeSingle();
      if (ufp?.display_name) setDisplayName(ufp.display_name);

      const { data, error } = await sb
        .from('matches')
        .select('id, user_a_id, user_b_id, status, created_at, blind_revealed, on_hold_at, meet_deadline')
        .or('user_a_id.eq.' + user.id + ',user_b_id.eq.' + user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMatches(data);
        const otherIds = data.map((m: any) => m.user_a_id === user.id ? m.user_b_id : m.user_a_id);
        if (otherIds.length > 0) {
          const { data: fps } = await sb.from('user_fingerprint').select('id, photos, display_name').in('id', otherIds);
          const map: Record<string, { photos: string[]; name: string }> = {};
          (fps ?? []).forEach((fp: any) => { map[fp.id] = { photos: fp.photos ?? [], name: fp.display_name ?? '' }; });
          setOtherUsers(map);
        }
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#06030f', fontFamily:'system-ui', color:'#6b5b8a', fontSize:14 }}>
      Finding your matches...
    </div>
  );

  const uid = userIdRef.current ?? userId;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#06030f,#0e0720)', color:'#fff', fontFamily:'system-ui', padding:'40px 24px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
          <h1 style={{ fontSize:28, fontWeight:400, fontFamily:'Georgia,serif', color:'#f4f0fc' }}>Your Matches</h1>
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            {uid && <NotificationBell userId={uid} />}
            <a href="/inside" style={{ fontSize:13, color:'#4a3a6a', textDecoration:'none' }}>Inside</a>
            <a href="/profile" style={{ fontSize:13, color:'#6b5b8a', textDecoration:'none' }}>Profile</a>
            <span style={{ color:'rgba(196,181,253,0.7)', fontSize:13, letterSpacing:'0.03em' }}>
              {displayName || (userEmail ? userEmail.split('@')[0] : '')}
            </span>
          </div>
        </div>

        {matches.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 24px', background:'rgba(124,58,237,0.04)', borderRadius:20, border:'1px solid rgba(124,58,237,0.12)' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>✦</div>
            <p style={{ fontSize:20, fontFamily:'Georgia,serif', color:'#e8d8f8', marginBottom:8 }}>You are in.</p>
            <p style={{ fontSize:15, color:'#6b5b8a', marginBottom:28, lineHeight:1.6 }}>We are matching you based on your values.<br/>Check back soon — or invite someone you would want to meet.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
              <a href="/invite/create" style={{ display:'inline-block', padding:'12px 24px', background:'linear-gradient(135deg,#7c3aed,#db2777)', color:'#fff', borderRadius:50, textDecoration:'none', fontWeight:600, fontSize:14 }}>Invite Someone</a>
              <a href="/inside" style={{ display:'inline-block', padding:'12px 24px', background:'rgba(124,58,237,0.1)', color:'#c4b5fd', borderRadius:50, textDecoration:'none', fontWeight:600, fontSize:14, border:'1px solid rgba(124,58,237,0.2)' }}>Inside BetterMate</a>
              <a href="/profile" style={{ display:'inline-block', padding:'12px 24px', background:'transparent', color:'#6b5b8a', borderRadius:50, textDecoration:'none', fontSize:13, border:'1px solid rgba(124,58,237,0.1)' }}>Edit Profile</a>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {matches.map((match) => {
              const otherId = match.user_a_id === uid ? match.user_b_id : match.user_a_id;
              const ou = otherUsers[otherId];
              const photo = ou?.photos?.[0];
              const name = ou?.name || null;
              const revealed = match.blind_revealed;
              const meetDL = match.meet_deadline ? new Date(match.meet_deadline) : null;
              const hoursLeft = meetDL ? Math.max(0, Math.floor((meetDL.getTime() - Date.now()) / 3600000)) : null;
              const isUrgent = hoursLeft !== null && hoursLeft <= 24 && hoursLeft > 0;
              const isExpired = meetDL && meetDL < new Date() && match.status !== 'completed_checked_in';
              return (
                <a key={match.id} href={'/matches/' + match.id} style={{ display:'flex', flexDirection:'column', background: isUrgent ? 'rgba(201,169,110,0.06)' : 'rgba(124,58,237,0.06)', borderRadius:16, border: isUrgent ? '1px solid rgba(201,169,110,0.3)' : '1px solid rgba(124,58,237,0.12)', textDecoration:'none', color:'#fff', overflow:'hidden' }}>
                  {isUrgent && (
                    <div style={{ background:'rgba(201,169,110,0.15)', padding:'8px 20px', fontSize:11, color:'#C9A96E', fontFamily:'system-ui', display:'flex', justifyContent:'space-between' }}>
                      <span>⏱ {hoursLeft}h left to plan your date</span>
                      <span style={{ opacity:0.7 }}>Extend for $0.99/day</span>
                    </div>
                  )}
                  {isExpired && match.status !== 'on_hold' && (
                    <div style={{ background:'rgba(124,58,237,0.1)', padding:'8px 20px', fontSize:11, color:'#a78bfa', fontFamily:'system-ui' }}>
                      Window closed · Extend chat to keep this connection alive
                    </div>
                  )}
                  <div style={{ display:'flex', alignItems:'center', gap:16, padding:20 }}>
                    {photo && revealed ? (
                      <img src={photo} alt="match" style={{ width:60, height:60, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid rgba(124,58,237,0.4)' }} />
                    ) : (
                      <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(219,39,119,0.1))', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>✦</div>
                    )}
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color: revealed ? 'rgba(167,139,250,0.6)' : '#4a3a6a', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.12em' }}>
                        {match.status === 'on_hold' ? 'On Hold' : revealed ? 'Revealed' : 'Blind Chat'}
                      </div>
                      <div style={{ fontWeight:600, color: revealed ? '#f4f0fc' : '#c4b5fd', fontSize:17, fontFamily:'Georgia,serif', marginBottom:4 }}>
                        {revealed && name ? name : 'A connection is waiting'}
                      </div>
                      <div style={{ fontSize:12, color:'#4a3a6a' }}>
                        {new Date(match.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}
                      </div>
                    </div>
                    <div style={{ fontSize:20, color:'rgba(124,58,237,0.4)' }}>›</div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
