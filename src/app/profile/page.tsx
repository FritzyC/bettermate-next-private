'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import PhotoUpload from '@/components/profile/PhotoUpload'
import { colors, fonts, radii } from '@/lib/bm/tokens'

export default function ProfilePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [photos, setPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) { router.replace('/auth'); return }
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/auth'); return }
      setUserId(user.id)
      sb.from('user_fingerprint').select('photos').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.photos) setPhotos(data.photos)
          setLoading(false)
        })
    })
  }, [router])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:colors.bgDeep, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:colors.textMuted, fontFamily:fonts.sans }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg, ${colors.bgDeep}, ${colors.bgBase})`, padding:'40px 20px' }}>
      <div style={{ maxWidth:480, margin:'0 auto' }}>
        {/* Header */}
        <button onClick={() => router.back()} style={{ background:'transparent', border:'none', color:colors.textMuted, fontFamily:fonts.sans, fontSize:14, cursor:'pointer', marginBottom:24, padding:0 }}>
          ← Back
        </button>
        <h1 style={{ fontFamily:fonts.serif, fontSize:28, color:colors.textPrimary, margin:'0 0 8px' }}>Your Profile</h1>
        <p style={{ fontFamily:fonts.sans, fontSize:15, color:colors.textMuted, margin:'0 0 32px' }}>Update your photos so people can recognise you when you meet.</p>

        {/* Preferences link */}
        <a href="/preferences" style={{ display:'block', padding:'16px 20px', background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.12)', borderRadius:16, color:'#c4b5fd', fontFamily:"Georgia,serif", fontSize:15, textDecoration:'none', marginBottom:16 }}>
          ⚙️ Match Preferences & Dealbreakers →
        </a>
        {/* Photo Upload */}
        <div style={{ padding:20, background:colors.bgCard, border:`1px solid ${colors.borderCard}`, borderRadius:radii.card, marginBottom:24 }}>
          <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:600, color:colors.textPrimary, fontFamily:fonts.sans }}>Profile Photos</p>
          <p style={{ margin:'0 0 16px', fontSize:12, color:colors.textMuted, fontFamily:fonts.sans }}>Up to 3 photos · JPG, PNG or WebP · Max 5MB each</p>
          {userId
            ? <PhotoUpload userId={userId} existingPhotos={photos} onPhotosChange={setPhotos} />
            : <p style={{ color:colors.textMuted, fontSize:13, fontFamily:fonts.sans }}>Loading…</p>
          }
        </div>

        {/* Saved indicator */}
        {photos.filter(Boolean).length > 0 && (
          <p style={{ textAlign:'center', fontFamily:fonts.sans, fontSize:13, color:colors.success }}>
            ✓ {photos.filter(Boolean).length} photo{photos.filter(Boolean).length > 1 ? 's' : ''} saved
          </p>
        )}
      </div>
    </div>
  )
}
