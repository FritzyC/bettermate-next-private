'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

type Timeframe = '24h' | '7d' | '30d'

function getStartDate(tf: Timeframe): string {
  const now = new Date()
  if (tf === '24h') now.setHours(now.getHours() - 24)
  else if (tf === '7d') now.setDate(now.getDate() - 7)
  else now.setDate(now.getDate() - 30)
  return now.toISOString()
}

function getPrevStartDate(tf: Timeframe): string {
  const now = new Date()
  if (tf === '24h') now.setHours(now.getHours() - 48)
  else if (tf === '7d') now.setDate(now.getDate() - 14)
  else now.setDate(now.getDate() - 60)
  return now.toISOString()
}

interface Metrics {
  totalUsers: number; newUsers: number; prevNewUsers: number
  onboardingComplete: number; onboardingTotal: number
  activeMatches: number; prevActiveMatches: number
  invitesSent: number; invitesAccepted: number
  prevInvitesSent: number; prevInvitesAccepted: number
  datePlansCreated: number; datePlansAccepted: number
  weeklyCheckins: number; prevWeeklyCheckins: number
  integrityBuckets: number[]; suppressedUsers: number
  songShares: number; creditEvents: number
  meetupsCompleted: number; prevMeetupsCompleted: number
  blindChatStarts: number; groupsCreated: number; ritualsCreated: number
}

const EMPTY: Metrics = {
  totalUsers:0,newUsers:0,prevNewUsers:0,onboardingComplete:0,onboardingTotal:0,
  activeMatches:0,prevActiveMatches:0,invitesSent:0,invitesAccepted:0,
  prevInvitesSent:0,prevInvitesAccepted:0,datePlansCreated:0,datePlansAccepted:0,
  weeklyCheckins:0,prevWeeklyCheckins:0,integrityBuckets:[0,0,0,0,0],suppressedUsers:0,
  songShares:0,creditEvents:0,meetupsCompleted:0,prevMeetupsCompleted:0,
  blindChatStarts:0,groupsCreated:0,ritualsCreated:0,
}

async function fetchMetrics(tf: Timeframe): Promise<Metrics> {
  const start = getStartDate(tf)
  const prevStart = getPrevStartDate(tf)
  const safe = async <T,>(fn: () => PromiseLike<{data:T|null;count?:number|null;error:unknown}>): Promise<{data:T|null;count:number}> => {
    try { const r = await fn(); return {data:r.data,count:r.count??0} }
    catch { return {data:null,count:0} }
  }
  const [a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w] = await Promise.all([
    safe(()=>supabase.from('user_fingerprint').select('id',{count:'exact',head:true})),
    safe(()=>supabase.from('user_fingerprint').select('id',{count:'exact',head:true}).gte('created_at',start)),
    safe(()=>supabase.from('user_fingerprint').select('id',{count:'exact',head:true}).gte('created_at',prevStart).lt('created_at',start)),
    safe(()=>supabase.from('user_fingerprint').select('user_id,onboarding_complete')),
    safe(()=>supabase.from('matches').select('id',{count:'exact',head:true}).gte('created_at',start).eq('status','active')),
    safe(()=>supabase.from('matches').select('id',{count:'exact',head:true}).gte('created_at',prevStart).lt('created_at',start).eq('status','active')),
    safe(()=>supabase.from('invites').select('id',{count:'exact',head:true}).gte('created_at',start)),
    safe(()=>supabase.from('invites').select('id',{count:'exact',head:true}).gte('created_at',start).eq('status','accepted')),
    safe(()=>supabase.from('invites').select('id',{count:'exact',head:true}).gte('created_at',prevStart).lt('created_at',start)),
    safe(()=>supabase.from('invites').select('id',{count:'exact',head:true}).gte('created_at',prevStart).lt('created_at',start).eq('status','accepted')),
    safe(()=>supabase.from('date_plans').select('id',{count:'exact',head:true}).gte('created_at',start)),
    safe(()=>supabase.from('date_plans').select('id',{count:'exact',head:true}).gte('created_at',start).eq('status','confirmed')),
    safe(()=>supabase.from('integrity_scores').select('score')),
    safe(()=>supabase.from('integrity_scores').select('user_id',{count:'exact',head:true}).eq('visibility_active',false)),
    safe(()=>supabase.from('song_share_log').select('id',{count:'exact',head:true}).gte('created_at',start)),
    safe(()=>supabase.from('behavior_events').select('id',{count:'exact',head:true}).gte('created_at',start).eq('event_type','checkin_completed')),
    safe(()=>supabase.from('behavior_events').select('id',{count:'exact',head:true}).gte('created_at',prevStart).lt('created_at',start).eq('event_type','checkin_completed')),
    safe(()=>supabase.from('behavior_events').select('id',{count:'exact',head:true}).gte('created_at',start).eq('event_type','date_plan_confirmed')),
    safe(()=>supabase.from('behavior_events').select('id',{count:'exact',head:true}).gte('created_at',prevStart).lt('created_at',start).eq('event_type','date_plan_confirmed')),
    safe(()=>supabase.from('behavior_events').select('id',{count:'exact',head:true}).gte('created_at',start).eq('event_type','blind_chat_unlocked')),
    safe(()=>supabase.from('groups').select('id',{count:'exact',head:true}).gte('created_at',start)),
    safe(()=>supabase.from('rituals').select('id',{count:'exact',head:true}).gte('created_at',start)),
    safe(()=>supabase.from('credit_transactions').select('id',{count:'exact',head:true}).gte('created_at',start).eq('type','purchase')),
  ])
  const fpRows = (d.data as {onboarding_complete:boolean}[]|null)??[]
  const intRows = (m.data as {score:number}[]|null)??[]
  const buckets=[0,0,0,0,0]
  intRows.forEach(row=>{buckets[Math.min(4,Math.floor(row.score/20))]++})
  return {
    totalUsers:a.count,newUsers:b.count,prevNewUsers:c.count,
    onboardingComplete:fpRows.filter(r=>r.onboarding_complete).length,onboardingTotal:fpRows.length,
    activeMatches:e.count,prevActiveMatches:f.count,
    invitesSent:g.count,invitesAccepted:h.count,prevInvitesSent:i.count,prevInvitesAccepted:j.count,
    datePlansCreated:k.count,datePlansAccepted:l.count,
    weeklyCheckins:p.count,prevWeeklyCheckins:q.count,
    integrityBuckets:buckets,suppressedUsers:n.count,
    songShares:o.count,creditEvents:w.count,
    meetupsCompleted:r.count,prevMeetupsCompleted:s.count,
    blindChatStarts:t.count,groupsCreated:u.count,ritualsCreated:v.count,
  }
}

function tr(cur:number,prev:number):{label:string;color:string}{
  if(prev===0)return{label:'—',color:'#7c6a9a'}
  const p=Math.round(((cur-prev)/prev)*100)
  if(p>0)return{label:`↑ ${p}%`,color:'#4ade80'}
  if(p<0)return{label:`↓ ${Math.abs(p)}%`,color:'#f87171'}
  return{label:'→ 0%',color:'#7c6a9a'}
}

function Card({label,value,sub,tl,tc,loading}:{label:string;value:string|number;sub?:string;tl?:string;tc?:string;loading:boolean}){
  return(
    <div style={{background:'rgba(124,58,237,0.05)',border:'1px solid rgba(124,58,237,0.12)',borderRadius:14,padding:'18px 20px'}}>
      {loading?<div style={{height:60,background:'rgba(124,58,237,0.08)',borderRadius:10,animation:'pulse 1.5s ease-in-out infinite'}}/>:<>
        <p style={{margin:'0 0 6px',fontSize:12,color:'rgba(196,181,253,0.6)',fontWeight:500}}>{label}</p>
        <p style={{margin:'0 0 4px',fontSize:28,fontWeight:700,color:'#fff',lineHeight:1}}>{value}</p>
        {sub&&<p style={{margin:0,fontSize:11,color:'rgba(196,181,253,0.4)'}}>{sub}</p>}
        {tl&&<p style={{margin:0,fontSize:11,color:tc}}>{tl}</p>}
      </>}
    </div>
  )
}

function Section({title,children}:{title:string;children:React.ReactNode}){
  return(
    <div style={{marginBottom:32}}>
      <p style={{margin:'0 0 14px',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(196,181,253,0.4)',textTransform:'uppercase'}}>{title}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>{children}</div>
    </div>
  )
}

function Histogram({buckets,loading}:{buckets:number[];loading:boolean}){
  const labels=['0–20','21–40','41–60','61–80','81–100']
  const max=Math.max(...buckets,1)
  return(
    <div style={{background:'rgba(124,58,237,0.05)',border:'1px solid rgba(124,58,237,0.12)',borderRadius:14,padding:'18px 20px',gridColumn:'span 2'}}>
      {loading?<div style={{height:60,background:'rgba(124,58,237,0.08)',borderRadius:10,animation:'pulse 1.5s ease-in-out infinite'}}/>:<>
        <p style={{margin:'0 0 12px',fontSize:12,color:'rgba(196,181,253,0.6)',fontWeight:500}}>Integrity Score Distribution</p>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',height:90}}>
          {buckets.map((v,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <span style={{fontSize:11,color:'#c4b5fd'}}>{v}</span>
              <div style={{width:'100%',height:`${Math.round((v/max)*60)}px`,minHeight:4,background:i>=3?'linear-gradient(180deg,#4ade80,#22c55e)':i===2?'linear-gradient(180deg,#7c3aed,#6d28d9)':'linear-gradient(180deg,#f87171,#ef4444)',borderRadius:'4px 4px 0 0'}}/>
              <span style={{fontSize:10,color:'#7c6a9a'}}>{labels[i]}</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  )
}

export default function MetricsClient(){
  const router=useRouter()
  const [authed,setAuthed]=useState<boolean|null>(null)
  const [tf,setTf]=useState<Timeframe>('7d')
  const [metrics,setMetrics]=useState<Metrics>(EMPTY)
  const [loading,setLoading]=useState(true)
  const [lastRefresh,setLastRefresh]=useState<Date|null>(null)

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user){router.replace('/auth');return}
      const email=(user.email??'').toLowerCase()
      if(ADMIN_EMAILS.length>0&&!ADMIN_EMAILS.includes(email)){setAuthed(false);return}
      setAuthed(true)
    })
  },[router])

  const refresh=useCallback(async()=>{
    setLoading(true)
    try{const m=await fetchMetrics(tf);setMetrics(m);setLastRefresh(new Date())}
    catch(e){console.error('metrics error',e)}
    finally{setLoading(false)}
  },[tf])

  useEffect(()=>{if(authed)refresh()},[authed,refresh])

  if(authed===null)return<Shell><p style={{color:'rgba(196,181,253,0.5)',fontSize:13}}>Verifying access…</p></Shell>
  if(authed===false)return<Shell><p style={{color:'rgba(196,181,253,0.5)',fontSize:13}}>Access denied.</p></Shell>

  const tfLabel=tf==='24h'?'last 24h':tf==='7d'?'last 7 days':'last 30 days'
  const invConv=metrics.invitesSent>0?`${Math.round((metrics.invitesAccepted/metrics.invitesSent)*100)}%`:'—'
  const onbRate=metrics.onboardingTotal>0?`${Math.round((metrics.onboardingComplete/metrics.onboardingTotal)*100)}%`:'—'
  const planRate=metrics.datePlansCreated>0?`${Math.round((metrics.datePlansAccepted/metrics.datePlansCreated)*100)}%`:'—'
  const northStar=metrics.newUsers>0?(metrics.meetupsCompleted/metrics.newUsers).toFixed(2):'0.00'
  const tMeetup=tr(metrics.meetupsCompleted,metrics.prevMeetupsCompleted)
  const tMatches=tr(metrics.activeMatches,metrics.prevActiveMatches)
  const tCheckins=tr(metrics.weeklyCheckins,metrics.prevWeeklyCheckins)
  const tUsers=tr(metrics.newUsers,metrics.prevNewUsers)

  return(
    <Shell>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{margin:'0 0 4px',fontSize:20,fontWeight:700,color:'#fff',fontFamily:'Georgia,serif'}}>BetterMate — Control Tower</h1>
          <p style={{margin:0,fontSize:12,color:'rgba(196,181,253,0.4)'}}>{lastRefresh?`Refreshed ${lastRefresh.toLocaleTimeString()}`:'Loading…'}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {(['24h','7d','30d'] as Timeframe[]).map(t=>(
            <button key={t} onClick={()=>setTf(t)} style={{padding:'6px 14px',borderRadius:20,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',background:tf===t?'#7c3aed':'rgba(124,58,237,0.08)',color:tf===t?'#fff':'#c4b5fd'}}>{t}</button>
          ))}
          <button onClick={refresh} disabled={loading} style={{padding:'6px 14px',borderRadius:20,border:'1px solid rgba(124,58,237,0.3)',background:'transparent',color:'#c4b5fd',fontSize:12,fontWeight:600,cursor:'pointer'}}>{loading?'…':'↻ Refresh'}</button>
        </div>
      </div>

      <div style={{background:'rgba(124,58,237,0.1)',border:'1px solid rgba(124,58,237,0.25)',borderRadius:14,padding:'24px 28px',marginBottom:32}}>
        {loading?<div style={{height:60,background:'rgba(124,58,237,0.08)',borderRadius:10,animation:'pulse 1.5s ease-in-out infinite'}}/>:<>
          <p style={{margin:'0 0 8px',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(196,181,253,0.5)',textTransform:'uppercase'}}>◈ North Star — Weekly Meetups per Active User</p>
          <p style={{margin:'0 0 4px',fontSize:48,fontWeight:700,color:'#fff',lineHeight:1}}>{northStar}</p>
          <p style={{margin:0,fontSize:12,color:tMeetup.color}}>{tMeetup.label} vs prev period · {tfLabel}</p>
        </>}
      </div>

      <Section title="User Funnel">
        <Card label="Total Users" value={metrics.totalUsers} sub="all-time" loading={loading}/>
        <Card label="New Users" value={metrics.newUsers} sub={tfLabel} tl={tUsers.label} tc={tUsers.color} loading={loading}/>
        <Card label="Onboarding Completion" value={onbRate} sub={`${metrics.onboardingComplete} of ${metrics.onboardingTotal}`} loading={loading}/>
      </Section>

      <Section title="Matching Liquidity">
        <Card label="Active Matches" value={metrics.activeMatches} sub={tfLabel} tl={tMatches.label} tc={tMatches.color} loading={loading}/>
        <Card label="Invites Sent" value={metrics.invitesSent} sub={tfLabel} loading={loading}/>
        <Card label="Invites Accepted" value={metrics.invitesAccepted} sub={tfLabel} loading={loading}/>
        <Card label="Invite Conversion" value={invConv} sub={tfLabel} loading={loading}/>
        <Card label="Blind Chat Unlocks" value={metrics.blindChatStarts} sub={tfLabel} loading={loading}/>
      </Section>

      <Section title="Real-World Engagement">
        <Card label="Date Plans Created" value={metrics.datePlansCreated} sub={tfLabel} loading={loading}/>
        <Card label="Plan Acceptance Rate" value={planRate} sub={`${metrics.datePlansAccepted} confirmed`} loading={loading}/>
        <Card label="Check-ins" value={metrics.weeklyCheckins} sub={tfLabel} tl={tCheckins.label} tc={tCheckins.color} loading={loading}/>
        <Card label="Meetups Completed" value={metrics.meetupsCompleted} sub={tfLabel} tl={tMeetup.label} tc={tMeetup.color} loading={loading}/>
      </Section>

      <Section title="Trust Layer">
        <Histogram buckets={metrics.integrityBuckets} loading={loading}/>
        <Card label="Suppressed Users" value={metrics.suppressedUsers} sub="visibility off" loading={loading}/>
      </Section>

      <Section title="Growth Health">
        <Card label="Micro-Groups Created" value={metrics.groupsCreated} sub={tfLabel} loading={loading}/>
        <Card label="Recurring Rituals" value={metrics.ritualsCreated} sub={tfLabel} loading={loading}/>
      </Section>

      <Section title="Monetization">
        <Card label="Song Shares Sent" value={metrics.songShares} sub={tfLabel} loading={loading}/>
        <Card label="Credit Purchases" value={metrics.creditEvents} sub={tfLabel} loading={loading}/>
      </Section>
    </Shell>
  )
}

function Shell({children}:{children:React.ReactNode}){
  return(
    <div style={{minHeight:'100dvh',background:'linear-gradient(160deg,#06030f 0%,#0e0720 55%,#110828 100%)',padding:'32px 24px',fontFamily:'system-ui,sans-serif'}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>{children}</div>
    </div>
  )
}
