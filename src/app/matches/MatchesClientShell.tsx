'use client';

import React, { useEffect, useState } from 'react';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function MatchesClientShell() {
  useOnboardingGuard();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = React.useRef<string | null>(null);
  const [otherUsers, setOtherUsers] = useState<Record<string, { photos: string[]; name: string }>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth?next=/matches'); return; }
      setUserEmail(user.email ?? null);
      setUserId(user.id);
      userIdRef.current = user.id;
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setMatches(data);
        // Fetch other user fingerprints for photos
        const otherIds = data.map((m: any) => m.user_a_id === user.id ? m.user_b_id : m.user_a_id);
        if (otherIds.length > 0) {
          const { data: fps } = await supabase.from('user_fingerprint').select('id, photos').in('id', otherIds);
          const { data: authData } = await supabase.from('user_fingerprint').select('id').in('id', otherIds);
          const map: Record<string, { photos: string[]; name: string }> = {};
          (fps ?? []).forEach((fp: any) => { map[fp.id] = { photos: fp.photos ?? [], name: '' }; });
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

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#06030f,#0e0720)', color:'#fff', fontFamily:'system-ui', padding:'40px 24px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
          <h1 style={{ fontSize:28, fontWeight:400, fontFamily:"Georgia,serif", color:'#e8d8f8' }}>Your Matches</h1>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <a href="/profile" style={{ fontSize:13, color:'#6b5b8a', textDecoration:'none' }}>Profile</a>
            <span style={{ color:'#2a1a45', fontSize:13 }}>{userEmail}</span>
          </div>
        </div>
        {matches.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 24px', background:'rgba(124,58,237,0.04)', borderRadius:20, border:'1px solid rgba(124,58,237,0.12)' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>✦</div>
            <p style={{ fontSize:20, fontFamily:"Georgia,serif", color:'#e8d8f8', marginBottom:8 }}>You're in.</p>
            <p style={{ fontSize:15, color:'#6b5b8a', marginBottom:28, lineHeight:1.6 }}>We're matching you based on your values.<br/>Check back soon — or invite someone you'd want to meet.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
              <a href="/invite/create" style={{ display:'inline-block', padding:'12px 24px', background:'linear-gradient(135deg,#7c3aed,#db2777)', color:'#fff', borderRadius:50, textDecoration:'none', fontWeight:600, fontSize:14 }}>
                Invite Someone →
              </a>
              <a href="/profile" style={{ display:'inline-block', padding:'12px 24px', background:'rgba(124,58,237,0.1)', color:'#c4b5fd', borderRadius:50, textDecoration:'none', fontWeight:600, fontSize:14, border:'1px solid rgba(124,58,237,0.2)' }}>
                Edit Profile
              </a>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {matches.map((match) => (
              <a key={match.id} href={'/matches/' + match.id} style={{ display:'flex', alignItems:'center', gap:16, padding:20, background:'rgba(124,58,237,0.06)', borderRadius:16, border:'1px solid rgba(124,58,237,0.12)', textDecoration:'none', color:'#fff' }}>
                {(() => {
                  const otherId = match.user_a_id === (userIdRef.current ?? userId) ? match.user_b_id : match.user_a_id;
                  const ou = otherUsers[otherId];
                  const photo = ou?.photos?.[0];
                  return photo ? (
                    <img src={photo} alt="match" style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid rgba(124,58,237,0.3)' }} />
                  ) : (
                    <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(124,58,237,0.15)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>✦</div>
                  );
                })()}
                <div>
                  <div style={{ fontSize:12, color:'#4a3a6a', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.1em' }}>Match</div>
                  <div style={{ fontWeight:600, color:'#e8d8f8' }}>{'#' + String(match.id).slice(0,8)}</div>
                  <div style={{ fontSize:12, color:'#3a2a55', marginTop:4 }}>{new Date(match.created_at).toLocaleDateString()}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
