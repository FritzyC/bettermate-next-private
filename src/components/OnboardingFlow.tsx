'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Step = 'welcome' | 'compact' | 'fingerprint' | 'values' | 'completion' | 'entry';
type Fingerprint = { music: string[]; hobbies: string[] };
type Values = { life_trajectory: string; conflict_style: string; finance_alignment: string; growth_orientation: string; relationship_readiness: string };

const MUSIC = ['Hip-Hop','R&B','Pop','Alternative','Indie','Jazz','House','Afrobeats','Latin','Classical','Rock','Soul','Electronic','Country','Reggae'];
const INTERESTS = ['Coffee walks','Fitness / gym','Live music','Art / museums','Food exploration','Hiking / outdoors','Comedy shows','Gaming','Dancing','Entrepreneurship','Study sessions','Sports events','Reading','Film / cinema','Cooking','Photography'];
const QUESTIONS = [
  { key: 'life_trajectory' as const, prompt: 'Where do you see your life going over the next few years?', options: ['Building something new','Growing steadily in a career','Exploring different paths','Focused on stability and balance'] },
  { key: 'conflict_style' as const, prompt: 'When something bothers you, what do you usually do first?', options: ['Talk about it directly','Take time to process before discussing','Try to smooth things over quickly','Avoid conflict unless necessary'] },
  { key: 'finance_alignment' as const, prompt: 'How do you generally think about money?', options: ['Invest and build long-term','Balance saving and enjoying life','Live experiences now','Prefer simplicity over financial ambition'] },
  { key: 'growth_orientation' as const, prompt: 'What excites you more?', options: ['Creating new things','Improving something that already works','Exploring possibilities','Helping others grow'] },
  { key: 'relationship_readiness' as const, prompt: "What are you genuinely open to right now?", options: ['Long-term relationship','Serious dating','Meeting people and seeing where it goes','Friendships and social connections'] },
];

const STEPS: Step[] = ['welcome','compact','fingerprint','values','completion','entry'];

const S = {
  shell: { minHeight:'100vh', background:'linear-gradient(160deg,#06030f 0%,#0e0720 50%,#110828 100%)', display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', padding:'60px 24px 40px' } as React.CSSProperties,
  wrap: { width:'100%', maxWidth:480 } as React.CSSProperties,
  eyebrow: { margin:'0 0 12px', fontSize:11, letterSpacing:'0.16em', textTransform:'uppercase' as const, color:'#4a3a6a', fontFamily:'system-ui,sans-serif' } as React.CSSProperties,
  h1: { fontFamily:"'Georgia',serif", fontSize:30, fontWeight:400, color:'#f0e6ff', margin:'0 0 14px', letterSpacing:'-0.02em', lineHeight:1.25 } as React.CSSProperties,
  body: { fontFamily:'system-ui,sans-serif', fontSize:14, color:'#7c6a9a', lineHeight:1.65, margin:'0 0 28px' } as React.CSSProperties,
  card: { background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.12)', borderRadius:16, padding:'24px 28px', marginBottom:36 } as React.CSSProperties,
};

function ProgressBar({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  if (step === 'welcome' || step === 'entry') return null;
  const pct = Math.round((Math.min(idx, STEPS.length - 2) / (STEPS.length - 2)) * 100);
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, height:3, background:'#1a0f2e' }}>
      <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#7c3aed,#db2777)', transition:'width 0.5s ease', borderRadius:'0 2px 2px 0' }} />
    </div>
  );
}

function Chip({ label, active, disabled, onClick }: { label:string; active:boolean; disabled:boolean; onClick:()=>void }) {
  return (
    <button onClick={() => !disabled && onClick()} style={{ padding:'10px 16px', borderRadius:50, border:`1.5px solid ${active ? '#7c3aed' : '#2a1645'}`, background: active ? 'rgba(124,58,237,0.12)' : 'transparent', color: active ? '#c4b5fd' : disabled ? '#2a1a45' : '#6a5a8a', fontSize:13, fontFamily:'system-ui,sans-serif', cursor: disabled ? 'not-allowed' : 'pointer', transition:'all 0.15s ease' }}>
      {label}
    </button>
  );
}

function Opt({ label, selected, onClick }: { label:string; selected:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ width:'100%', padding:'16px 20px', borderRadius:14, border:`1.5px solid ${selected ? '#7c3aed' : '#2a1645'}`, background: selected ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.02)', color: selected ? '#e9d5ff' : '#7c6a9a', fontSize:15, fontFamily:"'Georgia',serif", textAlign:'left', cursor:'pointer', transition:'all 0.18s ease', display:'flex', alignItems:'center', gap:12 }}>
      <span style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${selected ? '#7c3aed' : '#2a1645'}`, background: selected ? '#7c3aed' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.18s ease' }}>
        {selected && <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
      </span>
      {label}
    </button>
  );
}

function Btn({ children, onClick, disabled=false }: { children:React.ReactNode; onClick:()=>void; disabled?:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:'100%', padding:'18px', borderRadius:16, border:'none', background: disabled ? '#1a0f2e' : 'linear-gradient(135deg,#7c3aed,#db2777)', color: disabled ? '#2a1645' : '#fff', fontSize:16, fontFamily:"'Georgia',serif", cursor: disabled ? 'not-allowed' : 'pointer', transition:'all 0.2s ease' }}>
      {children}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={S.shell}><div style={S.wrap}>{children}</div></div>;
}

function Welcome({ onNext }: { onNext:()=>void }) {
  return (
    <Shell>
      <div style={{ textAlign:'center', marginBottom:40 }}>
        <div style={{ fontSize:44, marginBottom:20, color:'#7c3aed' }}>◈</div>
        <h1 style={S.h1}>BetterMate helps people<br />actually meet.</h1>
        <p style={S.body}>Most apps optimize swiping.<br />BetterMate optimizes real-world connection.</p>
        <div style={S.card}>
          {[['◈','Meet people who share your values'],['◉','Make plans, not endless chats'],['◐','Show up — integrity matters here']].map(([icon,text]) => (
            <div key={text} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14, fontFamily:'system-ui,sans-serif', fontSize:14, color:'#b09fd0' }}>
              <span style={{ color:'#7c3aed', fontSize:16, flexShrink:0 }}>{icon}</span>{text}
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:14, fontFamily:'system-ui,sans-serif', fontSize:14, color:'#b09fd0' }}>
            <span style={{ color:'#7c3aed', fontSize:16, flexShrink:0 }}>◐</span>Your profile powers everything — matching, venues, insights
          </div>
        </div>
      </div>
      <Btn onClick={onNext}>Start your profile →</Btn>
    </Shell>
  );
}

function Compact({ onNext }: { onNext:()=>void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Shell>
      <p style={S.eyebrow}>The BetterMate Compact</p>
      <h1 style={S.h1}>This community works because people show up.</h1>
      <p style={S.body}>Before joining, three things matter here:</p>
      <div style={{ marginBottom:32 }}>
        {['Be honest about who you are',"Respect people's time",'If you make a plan, do your best to keep it'].map((p,i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'18px 0', borderBottom: i < 2 ? '1px solid #12092a' : 'none' }}>
            <span style={{ width:28, height:28, borderRadius:'50%', background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#a78bfa', flexShrink:0, fontFamily:'system-ui,sans-serif' }}>{i+1}</span>
            <span style={{ fontFamily:"'Georgia',serif", fontSize:16, color:'#c4b5fd', lineHeight:1.5 }}>{p}</span>
          </div>
        ))}
      </div>
      <button onClick={() => setAgreed(!agreed)} style={{ display:'flex', alignItems:'center', gap:14, background:'transparent', border:'none', cursor:'pointer', marginBottom:32, padding:0 }}>
        <div style={{ width:24, height:24, borderRadius:6, border:`2px solid ${agreed ? '#7c3aed' : '#2a1645'}`, background: agreed ? '#7c3aed' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s ease', flexShrink:0 }}>
          {agreed && <span style={{ color:'#fff', fontSize:14 }}>✓</span>}
        </div>
        <span style={{ fontFamily:'system-ui,sans-serif', fontSize:15, color: agreed ? '#c4b5fd' : '#3a2a55', transition:'color 0.2s ease' }}>I'm in.</span>
      </button>
      <Btn onClick={onNext} disabled={!agreed}>Continue →</Btn>
    </Shell>
  );
}

function Fingerprint({ fp, setFp, onNext }: { fp:Fingerprint; setFp:(f:Fingerprint)=>void; onNext:()=>void }) {
  const toggleM = (g:string) => setFp({ ...fp, music: fp.music.includes(g) ? fp.music.filter(x=>x!==g) : [...fp.music,g] });
  const toggleH = (h:string) => setFp({ ...fp, hobbies: fp.hobbies.includes(h) ? fp.hobbies.filter(x=>x!==h) : [...fp.hobbies,h] });
  const ok = fp.music.length >= 1 && fp.hobbies.length >= 3;
  return (
    <Shell>
      <p style={S.eyebrow}>Cultural Fingerprint</p>
      <h1 style={S.h1}>What moves you?</h1>
      <p style={S.body}>Shapes your venue suggestions, activity matches, and compatibility context.</p>
      <div style={{ marginBottom:28 }}>
        <p style={{ fontFamily:'system-ui,sans-serif', fontSize:14, color:'#9a8ab0', margin:'0 0 12px', display:'flex', justifyContent:'space-between' }}>
          <span>What kind of music moves you?</span><span style={{ color:'#4a3a6a' }}>{fp.music.length}/5</span>
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {MUSIC.map(g => <Chip key={g} label={g} active={fp.music.includes(g)} disabled={!fp.music.includes(g)&&fp.music.length>=5} onClick={()=>toggleM(g)} />)}
        </div>
      </div>
      <div style={{ marginBottom:32 }}>
        <p style={{ fontFamily:'system-ui,sans-serif', fontSize:14, color:'#9a8ab0', margin:'0 0 12px', display:'flex', justifyContent:'space-between' }}>
          <span>What do you enjoy doing most?</span><span style={{ color:'#4a3a6a' }}>{fp.hobbies.length}/6</span>
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {INTERESTS.map(h => <Chip key={h} label={h} active={fp.hobbies.includes(h)} disabled={!fp.hobbies.includes(h)&&fp.hobbies.length>=6} onClick={()=>toggleH(h)} />)}
        </div>
      </div>
      {!ok && <p style={{ fontFamily:'system-ui,sans-serif', fontSize:12, color:'#3a2a55', textAlign:'center', marginBottom:16 }}>Choose at least 1 genre + 3 interests to continue</p>}
      <Btn onClick={onNext} disabled={!ok}>Continue →</Btn>
    </Shell>
  );
}

function ValuesQ({ values, setValues, onNext }: { values:Partial<Values>; setValues:(v:Partial<Values>)=>void; onNext:()=>void }) {
  const [qi, setQi] = useState(0);
  const q = QUESTIONS[qi];
  const cur = values[q.key];
  return (
    <Shell>
      <div style={{ display:'flex', gap:6, marginBottom:32 }}>
        {QUESTIONS.map((_,i) => (
          <div key={i} onClick={()=>i<qi&&setQi(i)} style={{ flex:1, height:3, borderRadius:2, background: i<=qi ? 'linear-gradient(90deg,#7c3aed,#db2777)' : '#1a0f2e', cursor: i<qi ? 'pointer' : 'default', transition:'background 0.3s ease' }} />
        ))}
      </div>
      <p style={S.eyebrow}>Question {qi+1} of {QUESTIONS.length}</p>
      <h1 style={{ ...S.h1, fontSize:22 }}>{q.prompt}</h1>
      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
        {q.options.map(opt => <Opt key={opt} label={opt} selected={cur===opt} onClick={()=>setValues({...values,[q.key]:opt})} />)}
      </div>
      <Btn onClick={()=>{ if(qi<QUESTIONS.length-1) setQi(qi+1); else onNext(); }} disabled={!cur}>
        {qi < QUESTIONS.length-1 ? 'Next →' : 'See your profile →'}
      </Btn>
      {qi > 0 && <button onClick={()=>setQi(qi-1)} style={{ width:'100%', padding:'14px', background:'transparent', border:'none', color:'#3a2a55', fontSize:13, fontFamily:'system-ui,sans-serif', cursor:'pointer', marginTop:10 }}>← Back</button>}
    </Shell>
  );
}

function Completion({ fp, values, onComplete, loading }: { fp:Fingerprint; values:Partial<Values>; onComplete:()=>void; loading:boolean }) {
  const checks = [{ label:'Values', done: Object.keys(values).length>=5 },{ label:'Interests', done: fp.hobbies.length>=3 },{ label:'Music', done: fp.music.length>=1 }];
  const pct = Math.round((checks.filter(c=>c.done).length / (checks.length+2))*100);
  return (
    <Shell>
      <p style={S.eyebrow}>Your BetterMate Profile</p>
      <h1 style={S.h1}>Looking good.</h1>
      <p style={S.body}>A complete profile improves your match quality.</p>
      <div style={{ ...S.card, textAlign:'center', marginBottom:24 }}>
        <div style={{ fontSize:52, fontWeight:300, fontFamily:"'Georgia',serif", color:'#c4b5fd', lineHeight:1, marginBottom:6 }}>{pct}%</div>
        <div style={{ fontSize:11, color:'#4a3a6a', fontFamily:'system-ui,sans-serif', letterSpacing:'0.1em' }}>PROFILE COMPLETE</div>
        <div style={{ height:4, background:'#1a0f2e', borderRadius:2, marginTop:16 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#7c3aed,#db2777)', borderRadius:2, transition:'width 0.8s ease' }} />
        </div>
      </div>
      <div style={{ marginBottom:16 }}>
        <p style={{ fontFamily:'system-ui,sans-serif', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3a2a55', marginBottom:10 }}>Completed</p>
        {checks.filter(c=>c.done).map(c => (
          <div key={c.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #0f0820', fontFamily:'system-ui,sans-serif', fontSize:14, color:'#9a8ab0' }}>
            <span style={{ color:'#7c3aed' }}>✓</span>{c.label}
          </div>
        ))}
      </div>
      <div style={{ marginBottom:32 }}>
        <p style={{ fontFamily:'system-ui,sans-serif', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#2a1a45', marginBottom:10 }}>Optional — Finish Later</p>
        {['Upload photos (max 3)','Connect Spotify','Verify safety preferences'].map(item => (
          <div key={item} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #0f0820', fontFamily:'system-ui,sans-serif', fontSize:14, color:'#2a1a45' }}>
            <span style={{ color:'#1a0f2e' }}>○</span>{item}
          </div>
        ))}
      </div>
      <Btn onClick={onComplete} disabled={loading}>{loading ? 'Saving your profile...' : 'Enter BetterMate →'}</Btn>
    </Shell>
  );
}

function Entry({ hasMatch }: { hasMatch:boolean }) {
  const router = useRouter();
  useEffect(() => { if(hasMatch) router.replace('/matches'); }, [hasMatch]);
  if (hasMatch) return null;
  return (
    <Shell>
      <div style={{ textAlign:'center', marginBottom:40 }}>
        <div style={{ fontSize:40, marginBottom:20, color:'#7c3aed' }}>◈</div>
        <h1 style={S.h1}>You're in.</h1>
        <p style={S.body}>BetterMate works best when you know who you're inviting.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <button onClick={()=>window.location.href='/invite'} style={{ padding:'22px 24px', borderRadius:16, border:'1.5px solid rgba(124,58,237,0.3)', background:'rgba(124,58,237,0.08)', color:'#c4b5fd', fontFamily:"'Georgia',serif", fontSize:16, cursor:'pointer', textAlign:'left' }}>
          <div style={{ marginBottom:6 }}>Invite Someone You Know</div>
          <div style={{ fontSize:12, fontFamily:'system-ui,sans-serif', color:'#5a4a7a' }}>Send a personal invite link to someone you already trust</div>
        </button>
        <button onClick={()=>window.location.href='/discover'} style={{ padding:'22px 24px', borderRadius:16, border:'1.5px solid #1a0f2e', background:'rgba(255,255,255,0.02)', color:'#7c6a9a', fontFamily:"'Georgia',serif", fontSize:16, cursor:'pointer', textAlign:'left' }}>
          <div style={{ marginBottom:6 }}>Enter Blind Chat</div>
          <div style={{ fontSize:12, fontFamily:'system-ui,sans-serif', color:'#3a2a55' }}>Meet people before seeing photos — connection first</div>
        </button>
      </div>
    </Shell>
  );
}

export default function OnboardingFlow() {
  // supabase already imported
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [fp, setFp] = useState<Fingerprint>({ music:[], hobbies:[] });
  const [values, setValues] = useState<Partial<Values>>({});
  const [loading, setLoading] = useState(false);
  const [hasMatch, setHasMatch] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { count } = await supabase.from('matches').select('id',{count:'exact',head:true}).or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).eq('status','active');
      setHasMatch((count??0)>0);
    })();
  }, []);

  const save = async () => {
    setLoading(true); setError(null);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error:e1 } = await supabase.from('user_fingerprint').upsert({ user_id:user.id, music_genres:fp.music, hobbies:fp.hobbies, onboarding_complete:true, updated_at:new Date().toISOString() },{ onConflict:'user_id' });
      if (e1) throw e1;
      const { error:e2 } = await supabase.from('user_values').upsert({ user_id:user.id, ...(values as Values), updated_at:new Date().toISOString() },{ onConflict:'user_id' });
      if (e2) throw e2;
      setStep('entry');
    } catch(e:unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <ProgressBar step={step} />
      {error && <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:'#3b0a0a', border:'1px solid #7f1d1d', color:'#fca5a5', padding:'12px 20px', borderRadius:10, fontFamily:'system-ui,sans-serif', fontSize:13, zIndex:100 }}>{error}</div>}
      {step==='welcome'    && <Welcome onNext={()=>setStep('compact')} />}
      {step==='compact'    && <Compact onNext={()=>setStep('fingerprint')} />}
      {step==='fingerprint'&& <Fingerprint fp={fp} setFp={setFp} onNext={()=>setStep('values')} />}
      {step==='values'     && <ValuesQ values={values} setValues={setValues} onNext={()=>setStep('completion')} />}
      {step==='completion' && <Completion fp={fp} values={values} onComplete={save} loading={loading} />}
      {step==='entry'      && <Entry hasMatch={hasMatch} />}
    </>
  );
}
