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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth?next=/matches'); return; }
      setUserEmail(user.email ?? null);
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (!error && data) setMatches(data);
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
              <a key={match.id} href={'/matches/' + match.id} style={{ display:'block', padding:20, background:'rgba(124,58,237,0.06)', borderRadius:16, border:'1px solid rgba(124,58,237,0.12)', textDecoration:'none', color:'#fff' }}>
                <div style={{ fontSize:12, color:'#4a3a6a', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.1em' }}>Match</div>
                <div style={{ fontWeight:600, color:'#e8d8f8' }}>{'#' + String(match.id).slice(0,8)}</div>
                <div style={{ fontSize:12, color:'#3a2a55', marginTop:8 }}>{new Date(match.created_at).toLocaleDateString()}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
