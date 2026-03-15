import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BOND_AMOUNT = 1500
const COMPENSATION_REWARD = 1000
const INTEGRITY_SHOWUP = 5
const INTEGRITY_SHOWUP_VS_NOSHOW = 3
const INTEGRITY_NOSHOW = -15

type BondStatus = 'pending' | 'waiting_counterparty' | 'active' | 'resolved' | 'cancelled_safety'
type CheckinValue = 'met' | 'no_show' | 'safety'
type ResolutionType = 'both_met' | 'one_no_show' | 'both_no_show'
type UserRole = 'a' | 'b'

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
  arrived_a: boolean
  arrived_b: boolean
  arrived_a_at: string | null
  arrived_b_at: string | null
  venue_lat: number | null
  venue_lng: number | null
  created_at: string
}

type AdminClient = Awaited<ReturnType<typeof getSupabaseAdmin>>

export async function GET(req: NextRequest) {
  const admin = await getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('matchId')
  const userId = searchParams.get('userId')
  if (!matchId || !userId) return NextResponse.json({ error: 'missing params' }, { status: 400 })
  const { data: bond } = await admin.from('commitment_bonds').select('*').eq('match_id', matchId).maybeSingle()
  const { data: credits } = await admin.from('user_credits').select('balance, locked_balance').eq('user_id', userId).maybeSingle()
  const { data: plan } = await admin.from('date_plans').select('final_time, status, final_venue, venue_lat, venue_lng').eq('match_id', matchId).maybeSingle()
  const scheduledAt = bond?.scheduled_at ?? plan?.final_time ?? null
  return NextResponse.json({ bond: bond ?? null, credits: credits ?? { balance: 0, locked_balance: 0 }, scheduledAt, venue: plan?.final_venue?.name ?? null, venueLat: plan?.venue_lat ?? null, venueLng: plan?.venue_lng ?? null })
}

export async function POST(req: NextRequest) {
  const admin = await getSupabaseAdmin()
  let body: { action: string; matchId?: string; userId?: string; checkinValue?: CheckinValue; scheduledAt?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const { action, matchId, userId, checkinValue, scheduledAt } = body
  if (!action || !matchId || !userId) return NextResponse.json({ error: 'missing params' }, { status: 400 })

  if (action === 'create') {
    const { data: existing } = await admin.from('commitment_bonds').select('*').eq('match_id', matchId).maybeSingle()
    if (existing) return NextResponse.json({ bond: existing })
    const { data: matchData } = await admin.from('matches').select('user_a_id, user_b_id').eq('id', matchId).single()
    if (!matchData) return NextResponse.json({ error: 'match not found' }, { status: 404 })
    const { data: bond, error } = await admin.from('commitment_bonds').insert({ match_id: matchId, user_a_id: matchData.user_a_id, user_b_id: matchData.user_b_id, status: 'pending' as BondStatus, agreed_a: false, agreed_b: false, locked_a: false, locked_b: false, scheduled_at: scheduledAt ?? null }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bond })
  }

  const { data: bond } = await admin.from('commitment_bonds').select('*').eq('match_id', matchId).maybeSingle()
  if (!bond) return NextResponse.json({ error: 'Bond not found. Create it first via action: create.' }, { status: 404 })
  const typedBond = bond as Bond
  const myRole: UserRole | null = typedBond.user_a_id === userId ? 'a' : typedBond.user_b_id === userId ? 'b' : null
  if (!myRole) return NextResponse.json({ error: 'user not in this bond' }, { status: 403 })
  const otherRole: UserRole = myRole === 'a' ? 'b' : 'a'

  if (action === 'lock') {
    if (typedBond[`locked_${myRole}` as keyof Bond]) return NextResponse.json({ bond: typedBond, already_locked: true })
    const dedupKey = `bond_lock_${typedBond.id}_${userId}`
    const { data: existingEntry } = await admin.from('credit_ledger').select('id').eq('dedup_key', dedupKey).maybeSingle()
    if (!existingEntry) {
      const { data: credits } = await admin.from('user_credits').select('balance, locked_balance').eq('user_id', userId).maybeSingle()
      const available = credits?.balance ?? 0
      const held = credits?.locked_balance ?? 0
      if (available < BOND_AMOUNT) return NextResponse.json({ error: 'insufficient_credits', available, needed: BOND_AMOUNT - available }, { status: 402 })
      await admin.from('user_credits').update({ balance: available - BOND_AMOUNT, locked_balance: held + BOND_AMOUNT }).eq('user_id', userId)
      await admin.from('credit_ledger').insert({ user_id: userId, amount: -BOND_AMOUNT, type: 'lock', bond_id: typedBond.id, dedup_key: dedupKey })
    }
    const lockUpdate: Record<string, unknown> = { [`agreed_${myRole}`]: true, [`locked_${myRole}`]: true }
    const otherLocked = typedBond[`locked_${otherRole}` as keyof Bond]
    if (otherLocked) {
      lockUpdate.status = 'active' as BondStatus
      if (scheduledAt) lockUpdate.scheduled_at = scheduledAt
    } else {
      lockUpdate.status = 'waiting_counterparty' as BondStatus
    }
    const { data: updatedBond, error: bondErr } = await admin.from('commitment_bonds').update(lockUpdate).eq('id', typedBond.id).select().single()
    if (bondErr) return NextResponse.json({ error: bondErr.message }, { status: 500 })
    if (lockUpdate.status === 'active') {
      const meetDeadline = scheduledAt
        ? new Date(new Date(scheduledAt).getTime() + 168 * 3600000).toISOString()
        : new Date(Date.now() + 168 * 3600000).toISOString()
      await admin.from('date_plans').update({ status: 'plan_scheduled' }).eq('match_id', matchId).eq('status', 'pending_pledge')
      await admin.from('matches').update({ meet_deadline: meetDeadline }).eq('id', matchId)
      await admin.from('messages').insert({ match_id: matchId, sender_user_id: null, content: '📅 Date confirmed. Both pledges are locked. Your credits will release after check-in.', type: 'system' }).select().maybeSingle()
    }
    return NextResponse.json({ bond: updatedBond })
  }

  if (action === 'arrive') {
    const { data: currentBond } = await admin.from('commitment_bonds').select('*').eq('match_id', matchId).maybeSingle()
    if (!currentBond) return NextResponse.json({ error: 'no bond' }, { status: 404 })
    const role: UserRole = currentBond.user_a_id === userId ? 'a' : 'b'
    const arrivedField = 'arrived_' + role
    const arrivedAtField = 'arrived_' + role + '_at'
    const { data: updated } = await admin.from('commitment_bonds')
      .update({ [arrivedField]: true, [arrivedAtField]: new Date().toISOString() })
      .eq('id', currentBond.id).select().single()
    return NextResponse.json({ bond: updated })
  }

  if (action === 'checkin') {
    const valid: CheckinValue[] = ['met', 'no_show', 'safety']
    if (!checkinValue || !valid.includes(checkinValue)) return NextResponse.json({ error: 'invalid checkin value' }, { status: 400 })
    if (checkinValue === 'safety') return resolveSafety(admin, typedBond)
    if (typedBond[`checkin_${myRole}` as keyof Bond]) return NextResponse.json({ bond: typedBond, already_checked_in: true })
    const { data: updatedBond } = await admin.from('commitment_bonds').update({ [`checkin_${myRole}`]: checkinValue }).eq('id', typedBond.id).select().single()
    const freshBond = updatedBond as Bond
    const otherCheckin = freshBond[`checkin_${otherRole}` as keyof Bond] as CheckinValue | null
    if (otherCheckin) return resolveCheckin(admin, freshBond, freshBond.checkin_a!, freshBond.checkin_b!)
    return NextResponse.json({ bond: freshBond, status: 'waiting_other_checkin' })
  }

  if (action === 'cancel_safety') return resolveSafety(admin, typedBond)

  if (action === 'check_resolution') {
    if (typedBond.status !== 'active') return NextResponse.json({ bond: typedBond })
    const dateStr = typedBond.scheduled_at
    if (!dateStr) return NextResponse.json({ bond: typedBond })
    const dateTime = new Date(dateStr)
    const now = new Date()
    if (now <= dateTime) return NextResponse.json({ bond: typedBond })
    const deadline = new Date(dateTime.getTime() + 48 * 60 * 60 * 1000)
    if (now < deadline) return NextResponse.json({ bond: typedBond, show_checkin_prompt: true })
    const resolvedA: CheckinValue = typedBond.checkin_a ?? 'no_show'
    const resolvedB: CheckinValue = typedBond.checkin_b ?? 'no_show'
    await admin.from('commitment_bonds').update({ checkin_a: resolvedA, checkin_b: resolvedB }).eq('id', typedBond.id)
    const synced = { ...typedBond, checkin_a: resolvedA, checkin_b: resolvedB }
    return resolveCheckin(admin, synced, resolvedA, resolvedB)
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

async function resolveSafety(admin: AdminClient, bond: Bond): Promise<Response> {
  if (bond.status === 'cancelled_safety' || bond.status === 'resolved') return NextResponse.json({ bond })
  const toRefund: string[] = []
  if (bond.locked_a) toRefund.push(bond.user_a_id)
  if (bond.locked_b) toRefund.push(bond.user_b_id)
  for (const uid of toRefund) {
    const dk = `bond_safety_refund_${bond.id}_${uid}`
    const { data: existing } = await admin.from('credit_ledger').select('id').eq('dedup_key', dk).maybeSingle()
    if (!existing) {
      const { data: credits } = await admin.from('user_credits').select('balance, locked_balance').eq('user_id', uid).maybeSingle()
      if (credits) {
        await admin.from('user_credits').update({ balance: credits.balance + BOND_AMOUNT, locked_balance: Math.max(0, credits.locked_balance - BOND_AMOUNT) }).eq('user_id', uid)
        await admin.from('credit_ledger').insert({ user_id: uid, amount: BOND_AMOUNT, type: 'safety_refund', bond_id: bond.id, dedup_key: dk })
      }
    }
  }
  const { data: updatedBond } = await admin.from('commitment_bonds').update({ status: 'cancelled_safety', resolved_at: new Date().toISOString() }).eq('id', bond.id).select().single()
  return NextResponse.json({ bond: updatedBond })
}

async function resolveCheckin(admin: AdminClient, bond: Bond, checkinA: CheckinValue, checkinB: CheckinValue) {
  if (bond.status === 'resolved') return NextResponse.json({ bond })
  const bothMet = checkinA === 'met' && checkinB === 'met'
  const bothNoShow = checkinA === 'no_show' && checkinB === 'no_show'
  const aNoShow = checkinA === 'no_show' && checkinB === 'met'
  const bNoShow = checkinB === 'no_show' && checkinA === 'met'
  let resolutionType: ResolutionType
  if (bothMet) {
    resolutionType = 'both_met'
    await releaseCredits(admin, bond.user_a_id, bond.id)
    await releaseCredits(admin, bond.user_b_id, bond.id)
    await adjustIntegrity(admin, bond.user_a_id, INTEGRITY_SHOWUP)
    await adjustIntegrity(admin, bond.user_b_id, INTEGRITY_SHOWUP)
  } else if (bothNoShow) {
    resolutionType = 'both_no_show'
    await forfeitCredits(admin, bond.user_a_id, bond.id)
    await forfeitCredits(admin, bond.user_b_id, bond.id)
    await adjustIntegrity(admin, bond.user_a_id, INTEGRITY_NOSHOW)
    await adjustIntegrity(admin, bond.user_b_id, INTEGRITY_NOSHOW)
  } else if (aNoShow) {
    resolutionType = 'one_no_show'
    await forfeitCredits(admin, bond.user_a_id, bond.id)
    await adjustIntegrity(admin, bond.user_a_id, INTEGRITY_NOSHOW)
    await releaseCredits(admin, bond.user_b_id, bond.id)
    await issueCompensation(admin, bond.user_b_id, bond.id)
    await adjustIntegrity(admin, bond.user_b_id, INTEGRITY_SHOWUP_VS_NOSHOW)
  } else if (bNoShow) {
    resolutionType = 'one_no_show'
    await forfeitCredits(admin, bond.user_b_id, bond.id)
    await adjustIntegrity(admin, bond.user_b_id, INTEGRITY_NOSHOW)
    await releaseCredits(admin, bond.user_a_id, bond.id)
    await issueCompensation(admin, bond.user_a_id, bond.id)
    await adjustIntegrity(admin, bond.user_a_id, INTEGRITY_SHOWUP_VS_NOSHOW)
  } else {
    return resolveSafety(admin, bond)
  }
  const { data: updatedBond } = await admin.from('commitment_bonds').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolution_type: resolutionType }).eq('id', bond.id).select().single()
  return NextResponse.json({ bond: updatedBond, resolution: resolutionType })
}

async function releaseCredits(admin: AdminClient, uid: string, bondId: string) {
  const dk = `bond_release_${bondId}_${uid}`
  const { data: ex } = await admin.from('credit_ledger').select('id').eq('dedup_key', dk).maybeSingle()
  if (ex) return
  const { data: cr } = await admin.from('user_credits').select('balance, locked_balance').eq('user_id', uid).maybeSingle()
  if (!cr) return
  await admin.from('user_credits').update({ balance: cr.balance + BOND_AMOUNT, locked_balance: Math.max(0, cr.locked_balance - BOND_AMOUNT) }).eq('user_id', uid)
  await admin.from('credit_ledger').insert({ user_id: uid, amount: BOND_AMOUNT, type: 'release', bond_id: bondId, dedup_key: dk })
}

async function forfeitCredits(admin: AdminClient, uid: string, bondId: string) {
  const dk = `bond_forfeit_${bondId}_${uid}`
  const { data: ex } = await admin.from('credit_ledger').select('id').eq('dedup_key', dk).maybeSingle()
  if (ex) return
  const { data: cr } = await admin.from('user_credits').select('locked_balance').eq('user_id', uid).maybeSingle()
  if (!cr) return
  await admin.from('user_credits').update({ locked_balance: Math.max(0, cr.locked_balance - BOND_AMOUNT) }).eq('user_id', uid)
  await admin.from('credit_ledger').insert({ user_id: uid, amount: -BOND_AMOUNT, type: 'forfeit', bond_id: bondId, dedup_key: dk })
}

async function issueCompensation(admin: AdminClient, uid: string, bondId: string) {
  const dk = `bond_compensation_${bondId}_${uid}`
  const { data: ex } = await admin.from('credit_ledger').select('id').eq('dedup_key', dk).maybeSingle()
  if (ex) return
  const { data: cr } = await admin.from('user_credits').select('balance').eq('user_id', uid).maybeSingle()
  if (!cr) return
  await admin.from('user_credits').update({ balance: cr.balance + COMPENSATION_REWARD }).eq('user_id', uid)
  await admin.from('credit_ledger').insert({ user_id: uid, amount: COMPENSATION_REWARD, type: 'compensation', bond_id: bondId, dedup_key: dk })
}

async function adjustIntegrity(admin: AdminClient, uid: string, delta: number) {
  const { data: fp } = await admin.from('user_fingerprint').select('integrity_score').eq('id', uid).maybeSingle()
  if (!fp) return
  const next = Math.min(100, Math.max(0, (fp.integrity_score ?? 50) + delta))
  await admin.from('user_fingerprint').update({ integrity_score: next }).eq('id', uid)
}
