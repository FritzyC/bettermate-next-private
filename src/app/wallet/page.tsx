'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import { colors } from '@/lib/bm/tokens'
import AddCredits from '@/components/AddCredits'

interface Credits {
  balance: number
  locked_balance: number
}

interface LedgerEntry {
  id: string
  amount: number
  type: string
  bond_id: string | null
  created_at: string
}

const LABEL: Record<string, string> = {
  lock: 'Bond locked',
  release: 'Bond released',
  forfeit: 'Bond forfeited',
  compensation: 'No-show compensation',
  safety_refund: 'Safety refund',
  topup: 'Credit top-up',
  stripe_topup: 'Credit top-up',
}

export default function WalletPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [credits, setCredits] = useState<Credits | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showTopup, setShowTopup] = useState(false)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) { setLoading(false); return }
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) { setUserId(session.user.id); return }
      // localStorage fallback
      if (typeof window !== 'undefined') {
        const lsKey = Object.keys(localStorage).find(k => k.includes('auth-token'))
        if (lsKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(lsKey) ?? '{}')
            const uid = parsed?.user?.id
            if (uid) { setUserId(uid); return }
          } catch {}
        }
      }
      sb.auth.getUser().then(({ data }) => {
        if (data.user) setUserId(data.user.id)
        else setLoading(false)
      })
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    fetch('/api/wallet?userId=' + userId)
      .then((r) => r.json())
      .then((data) => {
        setCredits({ balance: data.balance ?? 0, locked_balance: data.locked_balance ?? 0 })
        setLedger(data.ledger ?? [])
        setLoading(false)
      })
      .catch(() => {
        setCredits({ balance: 0, locked_balance: 0 })
        setLoading(false)
      })
  }, [userId])

  async function handleTopupSuccess() {
    if (!userId) return
    setShowTopup(false)
    await new Promise((r) => setTimeout(r, 2500))
    const res = await fetch('/api/wallet?userId=' + userId)
    const data = await res.json()
    setCredits({ balance: data.balance, locked_balance: data.locked_balance })
    setLedger(data.ledger ?? [])
  }

  const gold = '#C9A96E'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: colors.bgDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontFamily: 'Georgia, serif', fontSize: 14 }}>
      Loading...
    </div>
  )

  const total = (credits?.balance ?? 0) + (credits?.locked_balance ?? 0)

  return (
    <div style={{ minHeight: '100vh', background: colors.bgDeep, fontFamily: 'Georgia, serif', padding: '0 0 40px' }}>

      <div style={{ background: 'linear-gradient(180deg, #160b2e 0%, #0e0720 100%)', borderBottom: '1px solid ' + colors.borderVisible, padding: '28px 24px 24px' }}>
        <h1 style={{ margin: 0, color: colors.textPrimary, fontSize: 22, fontWeight: 600, letterSpacing: 0.3 }}>Wallet</h1>
        <p style={{ margin: '4px 0 0', color: colors.textMuted, fontSize: 13 }}>BetterMate credits - non-redeemable, card-funded only</p>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(219,39,119,0.1) 100%)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 14, padding: '18px 16px' }}>
            <p style={{ margin: '0 0 6px', color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Available</p>
            <p style={{ margin: 0, color: colors.textPrimary, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
              {(credits?.balance ?? 0).toLocaleString()}
            </p>
            <p style={{ margin: '2px 0 0', color: colors.textMuted, fontSize: 11 }}>credits</p>
          </div>

          <div style={{ background: 'rgba(201, 169, 110, 0.08)', border: '1px solid rgba(201, 169, 110, 0.25)', borderRadius: 14, padding: '18px 16px' }}>
            <p style={{ margin: '0 0 6px', color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Held</p>
            <p style={{ margin: 0, color: gold, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
              {(credits?.locked_balance ?? 0).toLocaleString()}
            </p>
            <p style={{ margin: '2px 0 0', color: colors.textMuted, fontSize: 11 }}>in active pledges</p>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid ' + colors.borderVisible, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ color: colors.textMuted, fontSize: 13 }}>Total balance</span>
          <span style={{ color: colors.textSecondary, fontSize: 15, fontWeight: 600 }}>
    {       total.toLocaleString()} credits
          </span>
        </div>

        {!showTopup ? (
          <button onClick={() => setShowTopup(true)}
            style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Georgia, serif', letterSpacing: 0.3, marginBottom: 28 }}>
            Add Credits
          </button>
        ) : (
          <div style={{ marginBottom: 28 }}>
            <AddCredits onSuccess={handleTopupSuccess} onCancel={() => setShowTopup(false)} />
          </div>
        )}

        {(credits?.locked_balance ?? 0) > 0 && (
          <div style={{ background: 'rgba(201, 169, 110, 0.06)', border: '1px solid rgba(201, 169, 110, 0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: gold }}>Held credits</strong> are locked inside active Date Pledge Bonds and cannot be spent.
            They will release automatically after your check-in is complete.
          </div>
        )}

        {ledger.length > 0 && (
          <div>
            <h2 style={{ margin: '0 0 14px', color: colors.textSecondary, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Recent activity</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ledger.map((entry) => {
                const isCredit = entry.amount > 0
                return (
                  <div key={entry.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid ' + colors.borderVisible, borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13 }}>
                        {LABEL[entry.type] ?? entry.type}
                      </p>
                      <p style={{ margin: '2px 0 0', color: colors.textMuted, fontSize: 11 }}>
                        {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <span style={{ color: isCredit ? '#4ade80' : '#f87171', fontSize: 14, fontWeight: 600 }}>
                      {isCredit ? '+' : ''}{entry.amount.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {ledger.length === 0 && (
          <p style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>No transactions yet.</p>
        )}

        <p style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 32, lineHeight: 1.6 }}>
          BetterMate credits are virtual only. Not redeemable for cash. Non-transferable.<br />
          Credits are forfeited upon account deletion.
        </p>
      </div>
    </div>
  )
}
