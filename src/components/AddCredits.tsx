'use client'
import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getSupabase } from '@/lib/supabaseClient'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const BUNDLES = [
  { id: 'credits_500',  credits: 500,  cents: 499,  label: '500 credits',  hint: '$4.99' },
  { id: 'credits_1000', credits: 1000, cents: 999,  label: '1000 credits', hint: '$9.99' },
  { id: 'credits_2000', credits: 2000, cents: 1999, label: '2000 credits', hint: '$19.99' },
]

const SURFACE = '#1a0a2e'; const ELEVATED = '#2d1052'; const BORDER = '#5A3A8A'
const TEXT = '#ffffff'; const TEXT2 = '#c4b5fd'; const MUTED = '#9d84d0'
const SUCCESS = '#22c55e'; const ERROR = '#ef4444'; const GOLD = '#C9A96E'

function CheckoutForm({ bundleId, credits, customCents, onSuccess, onCancel }: {
  bundleId: string | null; credits: number; customCents: number | null; onSuccess: () => void; onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function createIntent() {
      const sb = getSupabase()
      if (!sb) { setError('Not authenticated'); return }
      let token: string | null = null
      const { data: { session } } = await sb.auth.getSession()
      token = session?.access_token ?? null
      if (!token && typeof window !== 'undefined') {
        const lsKey = Object.keys(localStorage).find(k => k.includes('auth-token'))
        if (lsKey) {
          try { token = JSON.parse(localStorage.getItem(lsKey) ?? '{}')?.access_token ?? null } catch {}
        }
      }
      if (!token) { setError('Please sign in to continue'); return }
      const body = customCents
        ? { custom_cents: customCents }
        : { bundle_id: bundleId }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      })
      const d = await res.json()
      if (d.clientSecret) setClientSecret(d.clientSecret)
      else setError(d.error || 'Failed to create payment')
    }
    createIntent()
  }, [bundleId, customCents])

  async function handlePay() {
    if (!stripe || !elements || !clientSecret) return
    setLoading(true); setError(null)
    const card = elements.getElement(CardElement)
    if (!card) return
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card }
    })
    if (stripeError) {
      setError(stripeError.message || 'Payment failed')
      setLoading(false)
      return
    }
    if (paymentIntent?.status === 'succeeded') {
      setDone(true)
      setTimeout(() => onSuccess(), 3000)
    }
    setLoading(false)
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: SUCCESS }}>Payment successful!</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Credits are being added to your wallet...</div>
    </div>
  )

  return (
    <div>
      {!clientSecret ? (
        <div style={{ textAlign: 'center', padding: 20, color: MUTED, fontSize: 13 }}>
          {error ? <span style={{ color: ERROR }}>{error}</span> : 'Preparing payment...'}
        </div>
      ) : (
        <div>
          <div style={{ padding: 14, background: ELEVATED, borderRadius: 12, border: '1px solid ' + BORDER, marginBottom: 16 }}>
            <CardElement options={{ style: { base: { color: '#fff', fontSize: '15px', '::placeholder': { color: MUTED } } } }} />
          </div>
          {error && <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid ' + ERROR, borderRadius: 10, fontSize: 12, color: ERROR, marginBottom: 12 }}>{error}</div>}
          <button onClick={handlePay} disabled={loading || !stripe}
            style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10, fontFamily: 'Georgia, serif' }}>
            {loading ? 'Processing...' : `Pay & Add ${credits} Credits`}
          </button>
          <button onClick={onCancel}
            style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 12, color: MUTED, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export default function AddCredits({ shortfall = 0, onSuccess, onCancel }: {
  shortfall?: number; onSuccess: () => void; onCancel: () => void
}) {
  const recommended = BUNDLES.find(b => b.credits >= shortfall) || BUNDLES[0]
  const [selected, setSelected] = useState<string | 'custom'>(recommended.id)
  const [customDollars, setCustomDollars] = useState<string>('')
  const [paying, setPaying] = useState(false)

  const bundle = BUNDLES.find(b => b.id === selected)
  const customCents = selected === 'custom' && customDollars ? Math.round(parseFloat(customDollars) * 100) : null
  const customCredits = customCents ? customCents : 0
  const displayCredits = selected === 'custom' ? customCredits : (bundle?.credits ?? 0)
  const canProceed = selected !== 'custom' || (customCents !== null && customCents >= 500)

  if (paying) return (
    <div style={{ background: SURFACE, borderRadius: 16, padding: 20, border: '1px solid ' + BORDER }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2, marginBottom: 16 }}>
        Adding {displayCredits} credits
      </div>
      <Elements stripe={stripePromise}>
        <CheckoutForm
          bundleId={selected !== 'custom' ? selected : null}
          credits={displayCredits}
          customCents={customCents}
          onSuccess={onSuccess}
          onCancel={() => setPaying(false)}
        />
      </Elements>
    </div>
  )

  return (
    <div style={{ background: SURFACE, borderRadius: 16, padding: 20, border: '1px solid ' + GOLD + '60' }}>
      <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Add Credits</div>
      {shortfall > 0 && (
        <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid ' + ERROR, borderRadius: 10, fontSize: 12, color: ERROR, marginBottom: 14 }}>
          You need {shortfall} more credits to lock the pledge.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {BUNDLES.map(b => (
          <button key={b.id} onClick={() => setSelected(b.id)}
            style={{ padding: '12px 16px', background: selected === b.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (selected === b.id ? GOLD : BORDER), borderRadius: 12, color: TEXT, fontSize: 13, fontWeight: selected === b.id ? 700 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{b.label}</span>
            <span style={{ color: selected === b.id ? GOLD : MUTED, fontSize: 12 }}>{b.hint}</span>
          </button>
        ))}
        <button onClick={() => setSelected('custom')}
          style={{ padding: '12px 16px', background: selected === 'custom' ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (selected === 'custom' ? GOLD : BORDER), borderRadius: 12, color: TEXT, fontSize: 13, fontWeight: selected === 'custom' ? 700 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Custom amount</span>
          <span style={{ color: selected === 'custom' ? GOLD : MUTED, fontSize: 12 }}>$5 minimum</span>
        </button>
        {selected === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: ELEVATED, border: '1px solid ' + GOLD, borderRadius: 12 }}>
            <span style={{ color: GOLD, fontSize: 16, fontWeight: 700 }}>$</span>
            <input
              type="number"
              min={5}
              step={1}
              placeholder="5.00"
              value={customDollars}
              onChange={e => setCustomDollars(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: TEXT, fontSize: 16, outline: 'none', fontFamily: 'Georgia, serif' }}
            />
            {customCents && customCents >= 500 && (
              <span style={{ color: MUTED, fontSize: 11 }}>{customCents} credits</span>
            )}
          </div>
        )}
      </div>
      <button onClick={() => canProceed && setPaying(true)} disabled={!canProceed}
        style={{ width: '100%', padding: 14, background: canProceed ? GOLD : ELEVATED, border: 'none', borderRadius: 12, color: canProceed ? '#000' : MUTED, fontSize: 14, fontWeight: 700, cursor: canProceed ? 'pointer' : 'not-allowed', marginBottom: 10, fontFamily: 'Georgia, serif' }}>
        {selected === 'custom'
          ? (canProceed ? `Add ${customCredits} Credits` : 'Enter $5 or more')
          : `Add ${bundle?.credits ?? 0} Credits — ${bundle?.hint ?? ''}`}
      </button>
      <button onClick={onCancel}
        style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 12, color: MUTED, fontSize: 13, cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  )
}
