'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { calculateCompatibility, type CompatibilityResult } from '@/lib/bm/calculateCompatibility';

function ScoreRing({ score, size=130 }: { score:number; size?:number }) {
  const [anim, setAnim] = useState(0);
  const r = (size/2)-8, circ = 2*Math.PI*r, offset = circ-(anim/100)*circ;
  useEffect(()=>{ const t=setTimeout(()=>setAnim(score),150); return ()=>clearTimeout(t); },[score]);
  const color = score>=85?'#c084fc':score>=70?'#a78bfa':score>=55?'#f0abca':'#f9a8c9';
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1a2e" strokeWidth={7}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition:'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}/>
    </svg>
  );
}

function Pips({ score, color }: { score:number; color:string }) {
  return (
    <div style={{ display:'flex', gap:5 }}>
      {Array.from({length:5}).map((_,i)=>(
        <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:i<score?color:'#2a2040', transition:`background 0.3s ease ${i*80}ms` }}/>
      ))}
    </div>
  );
}

export default function CompatibilitySnapshot({ matchId, otherUserId }: { matchId:string; otherUserId?:string }) {
  // supabase already imported
  const [data, setData] = useState<CompatibilityResult|null>(null);
  const [open, setOpen] = useState<string|null>(null);

  useEffect(()=>{
    (async()=>{
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      let otherId = otherUserId;
      if (!otherId) {
        const { data: match } = await supabase.from('matches').select('user_a_id,user_b_id').eq('id',matchId).maybeSingle();
        if (match) otherId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
      }
      if (!otherId) return;
      const [mine, theirs] = await Promise.all([
        supabase.from('user_values').select('*').eq('user_id',user.id).maybeSingle(),
        supabase.from('user_values').select('*').eq('user_id',otherId).maybeSingle(),
      ]);
      setData(calculateCompatibility(mine.data, theirs.data, matchId));
    })();
  },[matchId,otherUserId]);

  if (!data) return (
    <div style={{ padding:'32px 24px', color:'#6b5b8a', fontFamily:'system-ui,sans-serif', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:'#c084fc' }}/>
      <span style={{ fontSize:14 }}>Reading your connection...</span>
    </div>
  );

  const topColor = data.overallScore>=70?'#c084fc':'#f0abca';
  return (
    <div style={{ background:'linear-gradient(160deg,#0e0a1a 0%,#150d24 100%)', border:'1px solid #2a1f45', borderRadius:20, padding:'28px 24px', fontFamily:"'Georgia',serif", color:'#fff', marginBottom:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <p style={{ margin:'0 0 4px', fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', color:'#4a3a6a', fontFamily:'system-ui,sans-serif' }}>Why This Works</p>
          <h2 style={{ margin:0, fontSize:22, fontWeight:400, color:'#e8d8f8', letterSpacing:'-0.02em' }}>Compatibility Snapshot</h2>
        </div>
        <div style={{ padding:'4px 10px', borderRadius:20, background:data.isReal?'rgba(124,58,237,0.1)':'rgba(255,255,255,0.04)', border:`1px solid ${data.isReal?'rgba(124,58,237,0.2)':'#1e1634'}`, fontSize:10, fontFamily:'system-ui,sans-serif', color:data.isReal?'#a78bfa':'#3a2e5a', letterSpacing:'0.06em', textTransform:'uppercase', flexShrink:0 }}>
          {data.isReal?'● Live':'○ Preview'}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:24, background:'rgba(192,132,252,0.06)', borderRadius:16, padding:'20px 22px', marginBottom:24, border:'1px solid rgba(192,132,252,0.12)' }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <ScoreRing score={data.overallScore} size={130}/>
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', display:'flex', alignItems:'baseline', gap:1 }}>
            <span style={{ fontSize:30, fontWeight:300, color:'#e8d8f8', letterSpacing:'-0.03em', lineHeight:1 }}>{data.overallScore}</span>
            <span style={{ fontSize:13, color:'#4a3a6a' }}>%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:500, color:topColor, marginBottom:8 }}>{data.grade} Match</div>
          <p style={{ margin:0, fontSize:13, lineHeight:1.65, color:'#7a6a9a', fontFamily:'system-ui,sans-serif' }}>{data.summary}</p>
        </div>
      </div>

      <p style={{ margin:'0 0 14px', fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'#2e2248', fontFamily:'system-ui,sans-serif' }}>Dimension Breakdown</p>

      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
        {data.dimensions.map(d=>(
          <button key={d.id} onClick={()=>setOpen(open===d.id?null:d.id)} style={{ background:open===d.id?'rgba(192,132,252,0.05)':'#0e0a1a', border:`1px solid ${open===d.id?d.color+'33':'#1e1634'}`, borderRadius:14, padding:'15px 17px', cursor:'pointer', textAlign:'left', width:'100%', transition:'all 0.2s ease' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                <span style={{ fontSize:18, color:d.color }}>{d.icon}</span>
                <div>
                  <div style={{ fontSize:12, color:'#b8a8d8', marginBottom:6, fontFamily:'system-ui,sans-serif' }}>{d.label}</div>
                  <Pips score={d.score} color={d.color}/>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:13, fontWeight:500, color:d.color, fontFamily:'system-ui,sans-serif' }}>{d.score}/5</span>
                <span style={{ fontSize:11, color:'#3a2e5a', fontFamily:'system-ui,sans-serif' }}>{open===d.id?'↑':'↓'}</span>
              </div>
            </div>
            {open===d.id&&(
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #2a1f45' }}>
                <div style={{ fontSize:13, fontWeight:500, color:d.color, marginBottom:8, fontFamily:'system-ui,sans-serif' }}>{d.headline}</div>
                <p style={{ margin:0, fontSize:13, lineHeight:1.65, color:'#6a5a8a', fontFamily:'system-ui,sans-serif' }}>{d.detail}</p>
              </div>
            )}
          </button>
        ))}
      </div>
      <p style={{ margin:0, fontSize:10, color:'#2e2248', textAlign:'center', letterSpacing:'0.04em', lineHeight:1.5, fontFamily:'system-ui,sans-serif' }}>
        {data.isReal?'Scores reflect your real values. They evolve as you interact.':'Complete onboarding to unlock real compatibility data.'}
      </p>
    </div>
  );
}
