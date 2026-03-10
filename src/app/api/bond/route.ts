import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from "@/lib/supabase/server"

let _admin: any = null
async function admin() {
  if (!_admin) _admin = await getSupabaseAdmin()
  return _admin
}

const BOND_AMOUNT = 500 // credits
const FORFEIT_PCT = 0.8 // 80% forfeited on no-show, 20% returned
const INTEGRITY_SHOW_UP = 2
const INTEGRITY_NO_SHOW = -15
const INTEGRITY_SAFETY_CANCEL = 0

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await (await admin()).auth.getUser(token)
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, matchId, outcome } = await req.json()

  if (action === 'create') return createBond(user.id, matchId)
  if (action === 'agree') return agreeBond(user.id, matchId)
  if (action === 'lock') return lockBond(user.id, matchId)
  if (action === 'checkin') return checkinBond(user.id, matchId, outcome)
  if (action === 'cancel_safety') return cancelSafety(user.id, matchId)

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const matchId = req.nextUrl.searchParams.get('matchId')
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  const { data: bond } = await (await admin())
    .from('commitment_bonds').select('*').eq('match_id', matchId).single()

  // Also evaluate expiry on-demand
  if (bond && bond.status === 'active') {
    const { data: plan } = await (await admin())
      .from('date_plans').select('proposed_times').eq('match_id', matchId).single()
    if (plan?.proposed_times?.length > 0) {
      const agreedTime = plan.proposed_times.find((t: any) => t.agreed)?.time
      if (agreedTime) {
        const dateTime = new Date(agreedTime)
        const hoursSince = (Date.now() - dateTime.getTime()) / 3600000
        if (hoursSince > 48 && (!bond.checkin_a || !bond.checkin_b)) {
          await resolveBond(bond.id, bond, 'expired')
        }
      }
    }
  }

  const { data: fresh } = await (await admin())
    .from('commitment_bonds').select('*').eq('match_id', matchId).single()
  return NextResponse.json({ bond: fresh })
}

async function createBond(userId: string, matchId: string) {
  const { data: match } = await (await admin())
    .from('matches').select('user_a_id, user_b_id').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const { data: existing } = await (await admin())
    .from('commitment_bonds').select('id').eq('match_id', matchId).single()
  if (existing) return NextResponse.json({ error: 'Bond already exists' }, { status: 409 })

  const { data: bond, error } = await (await admin()).from('commitment_bonds').insert({
    match_id: matchId,
    user_a_id: match.user_a_id,
    user_b_id: match.user_b_id,
    amount_a: BOND_AMOUNT,
    amount_b: BOND_AMOUNT,
    status: 'proposed',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bond })
}

async function agreeBond(userId: string, matchId: string) {
  const { data: bond } = await (await admin())
    .from('commitment_bonds').select('*').eq('match_id', matchId).single()
  if (!bond) return NextResponse.json({ error: 'Bond not found' }, { status: 404 })

  const isA = bond.user_a_id === userId
  const update = isA ? { agreed_a: true } : { agreed_b: true }
  const { data: updated } = await (await admin())
    .from('commitment_bonds').update(update).eq('id', bond.id).select().single()
  return NextResponse.json({ bond: updated })
}

async function lockBond(userId: string, matchId: string) {
  const { data: bond } = await (await admin())
    .from('commitment_bonds').select('*').eq('match_id', matchId).single()
  if (!bond) return NextResponse.json({ error: 'Bond not found' }, { status: 404 })

  const isA = bond.user_a_id === userId
  const amount = isA ? bond.amount_a : bond.amount_b
  const alreadyLocked = isA ? bond.locked_a : bond.locked_b
  if (alreadyLocked) return NextResponse.json({ bond }) // idempotent

  // Check credits
  const { data: wallet } = await (await admin())
    .from('user_credits').select('balance, locked_balance').eq('user_id', userId).single()
  if (!wallet || wallet.balance < amount)
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })

  const dedupKey = `bond_lock_${bond.id}_${userId}`
  const { data: existing } = await (await admin())
    .from('credit_ledger').select('id').eq('dedup_key', dedupKey).single()
  if (!existing) {
    await (await admin()).from('credit_ledger').insert({
      user_id: userId, amount: -amount, type: 'bond_lock',
      bond_id: bond.id, dedup_key: dedupKey
    })
    await (await admin()).from('user_credits').update({
      balance: wallet.balance - amount,
      locked_balance: (wallet.locked_balance || 0) + amount
    }).eq('user_id', userId)
  }

  const lockUpdate = isA ? { locked_a: true } : { locked_b: true }
  const otherLocked = isA ? bond.locked_b : bond.locked_a
  const statusUpdate = otherLocked ? { ...lockUpdate, status: 'active' } : lockUpdate

  const { data: updated } = await (await admin())
    .from('commitment_bonds').update(statusUpdate).eq('id', bond.id).select().single()
  return NextResponse.json({ bond: updated })
}

async function checkinBond(userId: string, matchId: string, outcome: string) {
  const { data: bond } = await (await admin())
    .from('commitment_bonds').select('*').eq('match_id', matchId).single()
  if (!bond) return NextResponse.json({ error: 'Bond not found' }, { status: 404 })

  const isA = bond.user_a_id === userId
  const update = isA ? { checkin_a: outcome } : { checkin_b: outcome }
  await (await admin()).from('commitment_bonds').update(update).eq('id', bond.id)

  // Re-fetch and try to resolve
  const { data: fresh } = await (await admin())
    .from('commitment_bonds').select('*').eq('id', bond.id).single()

  if (fresh.checkin_a && fresh.checkin_b) {
    if (fresh.checkin_a === 'met' && fresh.checkin_b === 'met') {
      await resolveBond(bond.id, fresh, 'both_met')
    } else if (fresh.checkin_a === 'no_show') {
      await resolveBond(bond.id, fresh, 'no_show_a')
    } else if (fresh.checkin_b === 'no_show') {
      await resolveBond(bond.id, fresh, 'no_show_b')
    } else {
      await resolveBond(bond.id, fresh, 'both_met') // safety/reschedule = no penalty
    }
  }

  const { data: result } = await (await admin())
    .from('commitment_bonds').select('*').eq('id', bond.id).single()
  return NextResponse.json({ bond: result })
}

async function cancelSafety(userId: string, matchId: string) {
  const { data: bond } = await (await admin())
    .from('commitment_bonds').select('*').eq('match_id', matchId).single()
  if (!bond) return NextResponse.json({ error: 'Bond not found' }, { status: 404 })
  await resolveBond(bond.id, bond, 'cancelled_safety')
  const { data: result } = await (await admin())
    .from('commitment_bonds').select('*').eq('id', bond.id).single()
  return NextResponse.json({ bond: result })
}

async function resolveBond(bondId: string, bond: any, reason: string) {
  const isNoShowA = reason === 'no_show_a'
  const isNoShowB = reason === 'no_show_b'
  const isBothMet = reason === 'both_met'
  const isSafety = reason === 'cancelled_safety'

  const penaltyUserId = isNoShowA ? bond.user_a_id : isNoShowB ? bond.user_b_id : null

  // Unlock or forfeit credits
  for (const [uid, amount, locked] of [
    [bond.user_a_id, bond.amount_a, bond.locked_a],
    [bond.user_b_id, bond.amount_b, bond.locked_b],
  ] as [string, number, boolean][]) {
    if (!locked) continue
    const { data: wallet } = await (await admin())
      .from('user_credits').select('balance, locked_balance').eq('user_id', uid).single()
    if (!wallet) continue

    const isNoShow = uid === penaltyUserId
    const forfeit = isNoShow ? Math.floor(amount * FORFEIT_PCT) : 0
    const returnAmt = amount - forfeit

    const dedupKey = `bond_resolve_${bondId}_${uid}`
    const { data: existing } = await (await admin())
      .from('credit_ledger').select('id').eq('dedup_key', dedupKey).single()
    if (!existing) {
      if (returnAmt > 0) {
        await (await admin()).from('credit_ledger').insert({
          user_id: uid, amount: returnAmt, type: isNoShow ? 'bond_partial_return' : 'bond_unlock',
          bond_id: bondId, dedup_key: dedupKey
        })
      }
      if (forfeit > 0) {
        await (await admin()).from('credit_ledger').insert({
          user_id: uid, amount: -forfeit, type: 'bond_forfeit',
          bond_id: bondId, dedup_key: `bond_forfeit_${bondId}_${uid}`
        })
      }
      await (await admin()).from('user_credits').update({
        balance: wallet.balance + returnAmt,
        locked_balance: Math.max(0, (wallet.locked_balance || 0) - amount)
      }).eq('user_id', uid)
    }

    // Integrity score
    const integrityDelta = isNoShow ? INTEGRITY_NO_SHOW : isBothMet ? INTEGRITY_SHOW_UP : 0
    if (integrityDelta !== 0) {
      const { data: fp } = await (await admin())
        .from('user_fingerprint').select('integrity_score, no_show_count').eq('id', uid).single()
      if (fp) {
        const updates: any = {
          integrity_score: Math.min(100, Math.max(0, (fp.integrity_score || 50) + integrityDelta))
        }
        if (isNoShow) updates.no_show_count = (fp.no_show_count || 0) + 1
        await (await admin()).from('user_fingerprint').update(updates).eq('id', uid)
      }
    }
  }

  await (await admin()).from('commitment_bonds').update({
    status: reason === 'expired' ? 'expired' : penaltyUserId ? 'resolved_penalty' : 'completed',
    resolved_at: new Date().toISOString(),
    resolution_reason: reason,
    penalty_user_id: penaltyUserId,
    forfeited_credits: penaltyUserId
      ? Math.floor((penaltyUserId === bond.user_a_id ? bond.amount_a : bond.amount_b) * FORFEIT_PCT)
      : 0,
  }).eq('id', bondId)
}
