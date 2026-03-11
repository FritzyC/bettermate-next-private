'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/bm/track'

const SURFACE = '#1a0a2e'; const ELEVATED = '#2d1052'; const BORDER = '#5A3A8A'
const TEXT = '#ffffff'; const TEXT2 = '#c4b5fd'; const MUTED = '#9d84d0'
const BRAND = '#7c3aed'; const SUCCESS = '#22c55e'; const ERROR = '#ef4444'
const GOLD = '#C9A96E'
const BOND_AMOUNT = 1500

export default function CommitmentBond({ matchId, userId, inline = false }: { matchId: string; userId: string; inline?: boolean }) {
  const [open, setOpen] = useState(false)
  const [bond, setBond] = useState<any>(null)
  const [credits, setCredits] = useState(0)
  const [acting, setActing] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_credits').select('balance').eq('user_id', userId).single()
      .then(({ data }) => setCredits(data?.balance || 0))
    fetchBond()
    const ch = supabase.channel('bond_' + matchId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commitment_bonds', filter: 'match_id=eq.' + matchId }, () => fetchBond())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId, matchId])

  async function fetchBond() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const res = await fetch('/api/bond?matchId=' + matchId, { headers: { Authorization: 'Bearer ' + session.access_token } })
    const d = await res.json()
    setBond(d.bond || null)
    setLoading(false)
  }

  async function api(action: string, extra?: any) {
    setActing(true)
    const { data: { session } } = await supabase.auth.getSession()
    setError(null)
    if (!session) { setError('Not logged in'); setActing(false); return }
    const res = await fetch('/api/bond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ action, matchId, ...extra })
    })
    const d = await res.json()
    if (d.bond) setBond(d.bond)
    if (action === 'lock') {
      const { data: w } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
      setCredits(w?.balance || 0)
    }
    setActing(false)
    await trackEvent('bond_proposed', { match_id: matchId, action }, matchId)
  }

  async function apiLockPledge() {
    setActing(true)
    const { data: { session } } = await supabase.auth.getSession()
    setError(null)
    if (!session) { setError('Not logged in'); setActing(false); return }
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }
    // Step 1: create bond if needed
    if (!bond) {
      const r1 = await fetch('/api/bond', { method: 'POST', headers, body: JSON.stringify({ action: 'create', matchId }) })
      const d1 = await r1.json()
      if (d1.error && d1.error !== 'Bond already exists') { setError('Create failed: ' + d1.error); setActing(false); return }
    }
    // Step 2: agree
    const r2 = await fetch('/api/bond', { method: 'POST', headers, body: JSON.stringify({ action: 'agree', matchId }) })
    const d2 = await r2.json()
    if (d2.error) { setError('Agree failed: ' + d2.error); setActing(false); return }
    // Step 3: lock
    const r3 = await fetch('/api/bond', { method: 'POST', headers, body: JSON.stringify({ action: 'lock', matchId }) })
    const d3 = await r3.json()
    if (d3.error) { setError('Lock failed: ' + d3.error); setActing(false); return }
    if (d3.bond) setBond(d3.bond)
    const { data: w } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
    setCredits(w?.balance || 0)
    setActing(false)
  }

  const isA = bond?.user_a_id === userId
  const myAgreed = bond ? (isA ? bond.agreed_a : bond.agreed_b) : false
  const myLocked = bond ? (isA ? bond.locked_a : bond.locked_b) : false
  const otherLocked = bond ? (isA ? bond.locked_b : bond.locked_a) : false
  const otherAgreed = bond ? (isA ? bond.agreed_b : bond.agreed_a) : false
  const myCheckin = bond ? (isA ? bond.checkin_a : bond.checkin_b) : null

  const statusLabel = () => {
    if (!bond) return '💎 Lock bond to schedule a date'
    if (bond.status === 'active') return '🔒 Bond active — ready to plan'
    if (bond.status === 'completed') return '✅ Both showed up'
    if (bond.status === 'resolved_penalty') return '⚠️ No-show recorded'
    if (bond.status === 'cancelled_safety') return '🛡 Safety cancelled'
    if (myLocked && !otherLocked) return '⏳ Waiting for them to lock'
    if (!myLocked && otherLocked) return '⚡ They locked — your turn'
    if (myAgreed && !myLocked) return '📋 Agreed — lock your credits'
    if (!myAgreed) return '📋 Agreement needed'
    return '💎 Commitment Bond'
  }

  if (loading) return null

  return (
    <div style={{ borderBottom: inline ? 'none' : '1px solid ' + BORDER }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '100%', padding: '13px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>💎</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: bond?.status === 'active' ? SUCCESS : TEXT2 }}>Commitment Bond</div>
            <div style={{ fontSize: 11, color: MUTED }}>{statusLabel()}</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: 20 }}>

          {/* RESOLVED SUCCESS */}
          {bond?.status === 'completed' && (
            <div style={{ padding: 16, background: 'rgba(34,197,94,0.1)', border: '1px solid ' + SUCCESS, borderRadius: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: SUCCESS }}>Both showed up.</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 6 }}>1500 credits returned to each of you. Integrity +3.</div>
            </div>
          )}

          {/* RESOLVED PENALTY */}
          {bond?.status === 'resolved_penalty' && (
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid ' + ERROR, borderRadius: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: ERROR, marginBottom: 6 }}>⚠️ No-show recorded</div>
              <div style={{ fontSize: 12, color: TEXT2 }}>The no-show forfeited 1500 credits to BetterMate and received an integrity penalty. The show-up user received 1000 time-respect credits from BetterMate.</div>
            </div>
          )}

          {/* SAFETY CANCELLED */}
          {bond?.status === 'cancelled_safety' && (
            <div style={{ padding: 16, background: 'rgba(124,58,237,0.1)', border: '1px solid ' + BRAND, borderRadius: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: TEXT2 }}>🛡 Safety cancellation. Credits returned. No penalty.</div>
            </div>
          )}

          {error && <div style={{ padding: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 10, fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}
          {/* NO BOND YET — CREATE */}
          {!bond && (
            <div>
              <div style={{ padding: 16, background: ELEVATED, borderRadius: 14, border: '1px solid ' + GOLD + '50', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Required Before Scheduling</div>
                <p style={{ margin: '0 0 16px', fontSize: 15, color: TEXT, lineHeight: 1.75, fontFamily: 'Georgia,serif' }}>
                  Respect the plan. BetterMate is built for people who follow through. To schedule this date, both of you lock 1500 credits as a pledge.
                </p>
                {[
                  '✅ Show up: you get your credits back',
                  '❌ No-show: you forfeit credits and Integrity drops',
                  '💸 If they no-show: BetterMate credits you 1000 for your time',
                  '🛡 Safety first: cancel for safety and your credits unlock',
                ].map((item, i) => (
                  <div key={i} style={{ padding: '9px 14px', fontSize: 13, color: TEXT2, background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 8, lineHeight: 1.5 }}>{item}</div>
                ))}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3, accentColor: GOLD, width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>I'm committing to show up or cancel responsibly.</span>
                </label>
              </div>
              {credits < BOND_AMOUNT ? (
                <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid ' + ERROR, borderRadius: 12, fontSize: 13, color: ERROR, textAlign: 'center' }}>
                  You need 1500 credits to lock a pledge. You have {credits}.
                </div>
              ) : (
                <button onClick={() => { if (agreed) apiLockPledge() }} disabled={acting || !agreed}
                  style={{ width: '100%', padding: 14, background: agreed ? GOLD : ELEVATED, border: 'none', borderRadius: 12, color: agreed ? '#000' : MUTED, fontSize: 14, fontWeight: 700, cursor: agreed ? 'pointer' : 'not-allowed', letterSpacing: '0.02em' }}>
                  {acting ? 'Locking...' : 'Lock Pledge'}
                </button>
              )}
            </div>
          )}

          {/* STEP 1 — AGREE */}
          {bond && bond.status === 'proposed' && !myAgreed && (
            <div>
              <div style={{ padding: 16, background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2, marginBottom: 12 }}>Before locking credits, confirm you understand:</div>
                {[
                  'This locks 1500 credits to protect both people\'s time',
                  'No-shows forfeit credits and receive an integrity penalty',
                  'Safety cancellations are always allowed with no penalty',
                  'Credits are never transferred to the other user',
                ].map((item, i) => (
                  <div key={i} style={{ padding: '6px 12px', fontSize: 12, color: TEXT2, borderLeft: '2px solid ' + BRAND, marginBottom: 6 }}>{item}</div>
                ))}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: BRAND }} />
                  <span style={{ fontSize: 12, color: TEXT2, lineHeight: 1.5 }}>I understand this locks 1500 credits as a commitment. No-shows forfeit credits and reduce integrity.</span>
                </label>
              </div>
              <button onClick={() => { if (agreed) api('agree') }} disabled={!agreed || acting}
                style={{ width: '100%', padding: 14, background: agreed ? BRAND : ELEVATED, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: agreed ? 'pointer' : 'not-allowed' }}>
                {acting ? 'Saving...' : 'I Agree — Continue to Lock Credits'}
              </button>
            </div>
          )}

          {/* STEP 2 — LOCK */}
          {bond && myAgreed && !myLocked && (
            <div>
              <div style={{ padding: 16, background: ELEVATED, borderRadius: 14, border: '1px solid ' + GOLD + '40', marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: SUCCESS, marginBottom: 6 }}>✓ Agreement accepted</div>
                {!otherAgreed && <div style={{ fontSize: 12, color: GOLD, marginBottom: 10 }}>⏳ Waiting for the other person to agree first</div>}
                {otherAgreed && <div style={{ fontSize: 12, color: SUCCESS, marginBottom: 10 }}>✓ They agreed too — lock your credits to activate</div>}
                <div style={{ fontSize: 13, color: TEXT }}>Lock 1500 credits to activate your side of the bond.</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Your balance: {credits} credits</div>
              </div>
              <button onClick={() => api('lock')} disabled={acting || credits < BOND_AMOUNT}
                style={{ width: '100%', padding: 14, background: BRAND, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {acting ? 'Locking...' : 'Lock 1500 Credits'}
              </button>
            </div>
          )}

          {/* WAITING FOR OTHER */}
          {bond && myLocked && !otherLocked && (
            <div style={{ padding: 16, background: 'rgba(201,169,110,0.08)', border: '1px solid ' + GOLD + '40', borderRadius: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>Your 1500 credits are locked.</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Waiting for the other person to lock theirs. Once both locked, you can choose venues and schedule your date.</div>
            </div>
          )}

          {/* ACTIVE */}
          {bond?.status === 'active' && !myCheckin && (
            <div>
              <div style={{ padding: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid ' + SUCCESS + '40', borderRadius: 14, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: SUCCESS }}>Bond Active — Date Planning Unlocked</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Both sides locked. Go to 📅 Plan to choose a venue and time.</div>
              </div>
              <p style={{ fontSize: 13, color: TEXT2, marginBottom: 12 }}>After your date, check in here:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { outcome: 'met', label: '✅ Yes, we met', bg: 'rgba(34,197,94,0.1)', border: SUCCESS },
                  { outcome: 'no_show', label: '❌ They did not show up', bg: 'rgba(239,68,68,0.1)', border: ERROR },
                  { outcome: 'reschedule', label: '🔄 We rescheduled', bg: 'rgba(124,58,237,0.1)', border: BRAND },
                ].map(({ outcome, label, bg, border }) => (
                  <button key={outcome} onClick={() => api('checkin', { outcome })} disabled={acting}
                    style={{ padding: 12, background: bg, border: '1px solid ' + border, borderRadius: 12, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
                <button onClick={() => api('cancel_safety')} disabled={acting}
                  style={{ padding: 10, background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 12, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
                  🛡 Safety concern — cancel bond
                </button>
              </div>
            </div>
          )}

          {bond?.status === 'active' && myCheckin && (
            <div style={{ padding: 16, background: ELEVATED, borderRadius: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: TEXT2 }}>Check-in recorded: <strong style={{ color: TEXT }}>{myCheckin}</strong></div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Waiting for the other person to check in.</div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
