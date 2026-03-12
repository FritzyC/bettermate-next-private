'use client'

import { useEffect, useState, useCallback } from 'react'
import { trackEvent } from '@/lib/bm/track'
import { colors } from '@/lib/bm/tokens'
import AddCredits from './AddCredits'

type BondStatus = 'pending' | 'waiting_counterparty' | 'active' | 'resolved' | 'cancelled_safety'
type CheckinValue = 'met' | 'no_show' | 'safety'
type ResolutionType = 'both_met' | 'one_no_show' | 'both_no_show'

interface Bond {
  id: string
  match_id: string
  user_a_id: string
  user_b_id: string
  status: BondStatus
  agreed_a: boolean
  agreed_b: boolean
  locked_a: boolean
  locked_b: boolean
  checkin_a: CheckinValue | null
  checkin_b: CheckinValue | null
  scheduled_at: string | null
  resolved_at: string | null
  resolution_type: ResolutionType | null
  created_at: string
}

interface Credits {
  balance: number
  locked_balance: number
}

type ViewState =
  | 'loading'
  | 'idle'
  | 'pledge_form'
  | 'insufficient_credits'
  | 'waiting_counterparty'
  | 'both_locked'
  | 'checkin_prompt'
  | 'waiting_other_checkin'
  | 'resolved'
  | 'cancelled_safety'

interface CommitmentBondProps {
  matchId: string
  userId: string
  planStatus: string | null
  scheduledAt: string | null
  onDateConfirmed?: () => void
}

const BOND_AMOUNT = 1500

function formatDate(iso: string | null) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function isDatePast(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function determineView(
  bond: Bond | null,
  credits: Credits | null,
  planStatus: string | null,
  scheduledAt: string | null,
  userId: string
): ViewState {
  if (!bond) return planStatus === 'pending_pledge' ? 'pledge_form' : 'idle'
  if (bond.status === 'cancelled_safety') return 'cancelled_safety'
  if (bond.status === 'resolved') return 'resolved'
  const myRole = bond.user_a_id === userId ? 'a' : 'b'
  const otherRole: 'a' | 'b' = myRole === 'a' ? 'b' : 'a'
  const iLocked = bond[('locked_' + myRole) as keyof Bond] as boolean
  const otherLocked = bond[('locked_' + otherRole) as keyof Bond] as boolean
  const iCheckedIn = bond[('checkin_' + myRole) as keyof Bond] as CheckinValue | null
  if (bond.status === 'pending' || bond.status === 'waiting_counterparty') {
    if (!iLocked) return 'pledge_form'
    if (!otherLocked) return 'waiting_counterparty'
  }
  if (bond.status === 'active') {
    const effectiveDate = scheduledAt ?? bond.scheduled_at
    if (!isDatePast(effectiveDate)) return 'both_locked'
    if (!iCheckedIn) return 'checkin_prompt'
    return 'waiting_other_checkin'
  }
  return 'idle'
}

export default function CommitmentBond({ matchId, userId, planStatus, scheduledAt, onDateConfirmed }: CommitmentBondProps) {
  const [bond, setBond] = useState<Bond | null>(null)
  const [credits, setCredits] = useState<Credits | null>(null)
  const [view, setView] = useState<ViewState>('loading')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shortfall, setShortfall] = useState(0)
  const [resolution, setResolution] = useState<ResolutionType | null>(null)
  const [myRole, setMyRole] = useState<'a' | 'b' | null>(null)
  const [checkinSubmitted, setCheckinSubmitted] = useState<CheckinValue | null>(null)

  const apiBond = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/bond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, userId, ...body }),
    })
    return res.json()
  }, [matchId, userId])

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/bond?matchId=' + matchId + '&userId=' + userId)
    const data = await res.json()
    const fetchedBond: Bond | null = data.bond ?? null
    const fetchedCredits: Credits = data.credits ?? { balance: 0, locked_balance: 0 }
    const fetchedScheduledAt: string | null = data.scheduledAt ?? scheduledAt ?? null
    setBond(fetchedBond)
    setCredits(fetchedCredits)
    if (fetchedBond) {
      setMyRole(fetchedBond.user_a_id === userId ? 'a' : 'b')
      if (fetchedBond.resolution_type) setResolution(fetchedBond.resolution_type)
    }
    const nextView = determineView(fetchedBond, fetchedCredits, planStatus, fetchedScheduledAt, userId)
    setView(nextView)
    if (nextView === 'pledge_form') trackEvent('pledge.shown', { matchId })
    if (nextView === 'checkin_prompt') trackEvent('bond.checkin_prompt_shown', { matchId })
  }, [matchId, userId, planStatus, scheduledAt])

  useEffect(() => { fetchState() }, [fetchState])

  useEffect(() => {
    if (bond?.status === 'active' && isDatePast(scheduledAt ?? bond.scheduled_at)) {
      apiBond({ action: 'check_resolution' }).then((data) => {
        if (data.bond) {
          setBond(data.bond)
          setView(determineView(data.bond, credits, planStatus, scheduledAt, userId))
        }
      })
    }
  }, [bond?.status, scheduledAt, apiBond, credits, planStatus, userId])

  async function handleLock() {
    if (!agreed) return
    setBusy(true)
    trackEvent('bond.lock_attempt', { matchId })
    if (!bond) {
      const createData = await apiBond({ action: 'create', scheduledAt })
      if (createData.error) { setBusy(false); return }
      setBond(createData.bond)
    }
    const data = await apiBond({ action: 'lock', scheduledAt })
    setBusy(false)
    if (data.error === 'insufficient_credits') {
      setShortfall(data.needed as number)
      setView('insufficient_credits')
      return
    }
    if (data.bond) {
      setBond(data.bond)
      trackEvent('bond.locked', { matchId })
      if (data.bond.status === 'active') { trackEvent('bond.active', { matchId }); onDateConfirmed?.() }
      setView(determineView(data.bond, credits, planStatus, scheduledAt, userId))
      await fetchState()
    }
  }

  async function handleCheckin(value: CheckinValue) {
    setBusy(true)
    setCheckinSubmitted(value)
    trackEvent('bond.checkin_submitted', { matchId, value })
    const data = await apiBond({ action: 'checkin', checkinValue: value })
    setBusy(false)
    if (data.bond) {
      setBond(data.bond)
      if (data.bond.resolution_type) setResolution(data.bond.resolution_type)
      if (data.bond.status === 'resolved' || data.bond.status === 'cancelled_safety') {
        trackEvent('bond.resolved', { matchId, resolution: data.bond.resolution_type })
      }
      setView(determineView(data.bond, credits, planStatus, scheduledAt, userId))
    }
  }

  async function handleTopupSuccess() {
    await new Promise((r) => setTimeout(r, 2000))
    const res = await fetch('/api/bond?matchId=' + matchId + '&userId=' + userId)
    const data = await res.json()
    if (data.credits) setCredits(data.credits)
    handleLock()
  }

  const gold = '#C9A96E'
  const container: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0e0720 0%, #160b2e 100%)',
    border: '1px solid ' + colors.borderVisible,
    borderRadius: 16,
    padding: '28px 24px',
    fontFamily: 'Georgia, serif',
  }

  if (view === 'loading') return (
    <div style={{ ...container, opacity: 0.5, textAlign: 'center', color: colors.textMuted, padding: 20 }}>
      Loading pledge status...
    </div>
  )

  if (view === 'idle') return null

  if (view === 'pledge_form') return (
    <div style={container}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h3 style={{ margin: 0, color: gold, fontSize: 18, fontWeight: 600, letterSpacing: 0.3 }}>Date Pledge Bond</h3>
      </div>
      <p style={{ color: colors.textSecondary, fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
        Respect the plan. BetterMate is built for people who follow through. To schedule this date, both of you must lock{' '}
        <strong style={{ color: colors.textPrimary }}>1,500 credits</strong> as a pledge.
      </p>
      <div style={{ background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        {[
          { text: 'Show up: 1,500 credits return to you', color: '#4ade80' },
          { text: 'No-show: you forfeit 1,500 credits and your Integrity drops', color: '#f87171' },
          { text: 'If they no-show: BetterMate credits you 1,000 for your time', color: gold },
          { text: 'Safety first: cancel for safety and your credits unlock', color: colors.textSecondary },
        ].map(({ text, color }) => (
          <div key={text} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
            <span style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{text}</span>
          </div>
        ))}
      </div>
      <p style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.6, margin: '0 0 20px' }}>
        Credits are virtual BetterMate credits only. Not redeemable for cash. Wallet top-ups are card-funded only.
        If you delete your account, remaining credits are forfeited and not refunded.
      </p>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
        <input type="checkbox" checked={agreed}
          onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) trackEvent('pledge.accepted', { matchId }) }}
          style={{ marginTop: 2, accentColor: colors.purple, width: 16, height: 16, cursor: 'pointer' }} />
        <span style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
          I am committing to show up or cancel responsibly.
        </span>
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleLock} disabled={!agreed || busy}
          style={{ flex: 1, background: agreed && !busy ? 'linear-gradient(135deg, #7c3aed, #db2777)' : 'rgba(255,255,255,0.06)', color: agreed && !busy ? '#fff' : colors.textMuted, border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 14, fontWeight: 600, cursor: agreed && !busy ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', letterSpacing: 0.3, transition: 'all 0.2s' }}>
          {busy ? 'Locking...' : 'Lock Pledge'}
        </button>
        <button onClick={() => setView('idle')}
          style={{ background: 'transparent', color: colors.textMuted, border: '1px solid ' + colors.borderVisible, borderRadius: 10, padding: '13px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
          Not now
        </button>
      </div>
      {credits && (
        <p style={{ color: colors.textMuted, fontSize: 11, marginTop: 14, textAlign: 'center' }}>
          Your balance: {credits.balance.toLocaleString()} available &middot; {credits.locked_balance.toLocaleString()} held
        </p>
      )}
    </div>
  )

  if (view === 'insufficient_credits') return (
    <div style={container}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 10px', color: gold, fontSize: 17, fontWeight: 600 }}>Add credits to lock your pledge</h3>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          You need <strong style={{ color: colors.textPrimary }}>{shortfall.toLocaleString()} more credits</strong> to continue.
          The date cannot be scheduled until both pledges are locked.
        </p>
      </div>
      <AddCredits shortfall={shortfall} onSuccess={handleTopupSuccess} onCancel={() => setView('pledge_form')} />
    </div>
  )

  if (view === 'waiting_counterparty') return (
    <div style={{ ...container, textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 8px', color: gold, fontSize: 17, fontWeight: 600 }}>Your pledge is locked.</h3>
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
        Waiting for the other person to complete their pledge. The date will confirm automatically once both pledges are locked.
      </p>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201, 169, 110, 0.08)', border: '1px solid rgba(201, 169, 110, 0.3)', borderRadius: 8, padding: '8px 14px', color: gold, fontSize: 12 }}>
        1,500 credits held &middot; releasing after check-in
      </div>
    </div>
  )

  if (view === 'both_locked') {
    const dateStr = scheduledAt ?? bond?.scheduled_at
    return (
      <div style={{ ...container, textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px', color: gold, fontSize: 17, fontWeight: 600 }}>Date locked in. Both pledges are active.</h3>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 8px' }}>Check in after the date to release your credits.</p>
        {dateStr && <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>Scheduled: {formatDate(dateStr)}</p>}
      </div>
    )
  }

  if (view === 'checkin_prompt') return (
    <div style={container}>
      <h3 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: 17, fontWeight: 600 }}>Did the date happen?</h3>
      <p style={{ color: colors.textMuted, fontSize: 13, margin: '0 0 20px' }}>Your check-in determines how credits are released.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([
          { value: 'met' as CheckinValue, label: 'Yes, we met', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.08)' },
          { value: 'no_show' as CheckinValue, label: "They didn't show", color: '#f87171', bg: 'rgba(248, 113, 113, 0.08)' },
          { value: 'safety' as CheckinValue, label: 'Safety issue - cancel', color: gold, bg: 'rgba(201, 169, 110, 0.08)' },
        ] as const).map(({ value, label, color, bg }) => (
          <button key={value} onClick={() => handleCheckin(value)} disabled={busy}
            style={{ background: bg, border: '1px solid ' + color + '44', borderRadius: 10, padding: '13px 18px', color, fontSize: 14, fontWeight: 500, cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'Georgia, serif', opacity: busy ? 0.5 : 1, transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
        <button onClick={() => setView('both_locked')}
          style={{ background: 'transparent', border: 'none', color: colors.textMuted, fontSize: 12, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline' }}>
          Not now
        </button>
      </div>
    </div>
  )

  if (view === 'waiting_other_checkin') return (
    <div style={{ ...container, textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: 16, fontWeight: 600 }}>Your check-in is recorded.</h3>
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 10px', lineHeight: 1.6 }}>
        {checkinSubmitted === 'met'
          ? 'Waiting for the other person to confirm. Credits will release once they respond.'
          : 'Your response has been logged. BetterMate will resolve the pledge shortly.'}
      </p>
      <button onClick={fetchState}
        style={{ background: 'transparent', border: '1px solid ' + colors.borderVisible, borderRadius: 8, padding: '8px 18px', color: colors.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
        Refresh status
      </button>
    </div>
  )

  if (view === 'resolved') {
    const res = resolution ?? bond?.resolution_type
    const role = myRole ?? (bond?.user_a_id === userId ? 'a' : 'b')
    const iWasNoShow = (role === 'a' && bond?.checkin_a === 'no_show') || (role === 'b' && bond?.checkin_b === 'no_show')
    let headline = '', body = ''
    if (res === 'both_met') {
      headline = 'Date completed.'
      body = 'Your pledge has been returned. 1,500 credits are back in your wallet.'
    } else if (res === 'both_no_show') {
      headline = 'The pledge expired without completion.'
      body = 'Both users did not complete the date. Credits were forfeited.'
    } else if (res === 'one_no_show') {
      if (iWasNoShow) {
        headline = 'The pledge has been resolved.'
        body = 'Your 1,500 credits have been forfeited. Your Integrity score has been adjusted.'
      } else {
        headline = 'The pledge has been resolved.'
        body = 'BetterMate credited you 1,000 for your time. We appreciate your commitment.'
      }
    }
    return (
      <div style={{ ...container, textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: 17, fontWeight: 600 }}>{headline}</h3>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0, lineHeight: 1.6 }}>{body}</p>
      </div>
    )
  }

  if (view === 'cancelled_safety') return (
    <div style={{ ...container, textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 8px', color: colors.textPrimary, fontSize: 16, fontWeight: 600 }}>Safety cancellation recorded.</h3>
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0, lineHeight: 1.6 }}>Credits returned. No penalty applied. Your safety is the priority.</p>
    </div>
  )

  return null
}
