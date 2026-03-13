'use client'

import { useState, useEffect } from 'react'
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard'
import { getSupabase } from '@/lib/supabaseClient'
import { colors } from '@/lib/bm/tokens'

export default function CreateInviteClientShell() {
  useOnboardingGuard()
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function fetchCredits() {
    const sb = getSupabase()
    if (!sb) return
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    const { data } = await sb.from('user_fingerprint').select('invite_credits').eq('id', session.user.id).maybeSingle()
    setCredits(data?.invite_credits ?? 0)
  }

  useEffect(() => {
    fetchCredits()
    window.addEventListener('focus', fetchCredits)
    return () => window.removeEventListener('focus', fetchCredits)
  }, [])

  async function onCreateInvite() {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const sb = getSupabase()
      const sessionResult = sb ? await sb.auth.getSession() : null
      const accessToken = sessionResult?.data?.session?.access_token ?? null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      const res = await fetch('/api/invites/create', { method: 'POST', headers, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        setError(res.status === 401 ? 'You must be logged in to create an invite.' : String(data?.error ?? 'invite_create_failed'))
        return
      }
      setInviteUrl(data.invite_url ?? null)
      setCredits(c => (c !== null ? c - 1 : c))
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'network_error')
    } finally {
      setLoading(false)
    }
  }

  async function onCopy() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  function onShare() {
    if (!inviteUrl) return
    if (navigator.share) {
      navigator.share({ title: 'Join me on BetterMate', text: 'I saved a spot for you on BetterMate — invite only, values-first.', url: inviteUrl })
    } else {
      onCopy()
    }
  }

  const gold = '#C9A96E'
  const smsBody = encodeURIComponent('I saved a spot for you on BetterMate — invite only, values-first, no swiping. Your personal link: ' + (inviteUrl ?? ''))

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a041a 0%, #10062a 50%, #0a041a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: 'Georgia, serif' }}>

      <div style={{ marginBottom: 36, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #7c3aed, #db2777)', borderRadius: 16, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 700 }}>B</div>
        <p style={{ color: colors.textMuted, fontSize: 12, margin: 0, letterSpacing: 2, textTransform: 'uppercase' }}>BetterMate</p>
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(219,39,119,0.07) 100%)', border: '1px solid rgba(124,58,237,0.28)', borderRadius: 20, padding: '36px 32px', maxWidth: 420, width: '100%' }}>

        {!inviteUrl ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h1 style={{ margin: 0, color: colors.textPrimary, fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>Invite someone you trust</h1>
              {credits !== null && (
                <span style={{ background: credits > 0 ? 'rgba(201,169,110,0.12)' : 'rgba(248,113,113,0.1)', border: '1px solid ' + (credits > 0 ? 'rgba(201,169,110,0.3)' : 'rgba(248,113,113,0.3)'), borderRadius: 8, padding: '4px 10px', fontSize: 11, color: credits > 0 ? gold : '#f87171', fontFamily: 'Georgia, serif' }}>
                  {credits} invite{credits !== 1 ? 's' : ''} remaining
                </span>
              )}
            </div>
            <p style={{ color: colors.textSecondary, fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>
              BetterMate is invite-only. Your invite link is valid for 7 days and can be used once.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px', marginBottom: 28 }}>
              {[
                'Compatibility scoring across 5 dimensions',
                'Date Pledge Bond — credits at stake',
                'GPS venue check-in — no ghosting',
                'Integrity Score that follows you',
              ].map((line) => (
                <div key={line} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: gold, fontSize: 14, marginTop: 1 }}>+</span>
                  <span style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{line}</span>
                </div>
              ))}
            </div>
            {error && <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
            <button onClick={onCreateInvite} disabled={loading || credits === 0}
              style={{ width: '100%', background: (loading || credits === 0) ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #7c3aed, #db2777)', color: (loading || credits === 0) ? colors.textMuted : '#fff', border: 'none', borderRadius: 12, padding: '15px 24px', fontSize: 15, fontWeight: 700, cursor: (loading || credits === 0) ? 'not-allowed' : 'pointer', fontFamily: 'Georgia, serif', letterSpacing: 0.3, transition: 'all 0.2s' }}>
              {loading ? 'Generating link...' : credits === 0 ? 'No invites remaining' : 'Generate Invite Link'}
            </button>
          </>
        ) : (
          <>
            <h1 style={{ margin: '0 0 6px', color: gold, fontSize: 20, fontWeight: 700 }}>Your invite is ready</h1>
            <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
              Share this link with one person. It expires in 7 days and can only be used once.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, wordBreak: 'break-all', fontSize: 12, color: gold, fontFamily: 'monospace', lineHeight: 1.6 }}>
              {inviteUrl}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={onCopy}
                style={{ flex: 1, background: copied ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', color: copied ? '#4ade80' : colors.textSecondary, border: '1px solid ' + (copied ? 'rgba(74,222,128,0.3)' : colors.borderVisible), borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.2s' }}>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button onClick={onShare}
                style={{ flex: 1, background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                Share
              </button>
            </div>
            <a href={`sms:?body=${smsBody}`}
              style={{ display: 'block', textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, color: gold, fontFamily: 'Georgia, serif', textDecoration: 'none', marginBottom: 16 }}>
              Text This Invite
            </a>
            <button onClick={() => { setInviteUrl(null); setError(null) }}
              style={{ width: '100%', background: 'transparent', border: 'none', color: colors.textMuted, fontSize: 12, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline', fontFamily: 'Georgia, serif' }}>
              Generate another invite
            </button>
          </>
        )}
      </div>

      <p style={{ color: colors.textMuted, fontSize: 11, marginTop: 28, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        For people with serious intentions. Invite required. Each link is single-use and tied to your account.
      </p>
    </div>
  )
}
