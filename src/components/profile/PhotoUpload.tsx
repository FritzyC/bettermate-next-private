'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getSupabase } from '@/lib/supabaseClient'

interface PhotoUploadProps {
  userId: string
  existingPhotos?: string[]
  onPhotosChange?: (urls: string[]) => void
}

const MAX_PHOTOS = 3
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export default function PhotoUpload({ userId, existingPhotos = [], onPhotosChange }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos)
  const [uploading, setUploading] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const slotRef = useRef<number>(0)

  useEffect(() => { setPhotos(existingPhotos) }, [existingPhotos.join(',')])

  const getClient = useCallback(() => {
    const c = getSupabase()
    if (!c) throw new Error('No Supabase client')
    return c
  }, [])

  const upload = useCallback(async (file: File, slot: number) => {
    if (!ALLOWED.includes(file.type)) { setErrors(e => ({ ...e, [slot]: 'JPG, PNG or WebP only' })); return }
    if (file.size > MAX_SIZE) { setErrors(e => ({ ...e, [slot]: 'Max 5MB' })); return }
    setUploading(slot); setErrors(e => { const n = { ...e }; delete n[slot]; return n })
    try {
      const client = getClient()
      await client.auth.refreshSession()
      const { data: { session } } = await client.auth.getSession()
      if (!session?.user?.id) throw new Error('Not signed in — please refresh')
      const uid = session.user.id
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${uid}/${Date.now()}_${slot}.${ext}`
      if (photos[slot]) {
        const old = photos[slot].split('/profile-photos/')[1]
        if (old) await client.storage.from('profile-photos').remove([old])
      }
      const { error: upErr } = await client.storage.from('profile-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = client.storage.from('profile-photos').getPublicUrl(path)
      const next = [...photos]; next[slot] = publicUrl
      const clean = next.filter(Boolean)
      const { error: dbErr } = await client.from('user_fingerprint').upsert({ id: uid, photos: clean }, { onConflict: 'id' })
      if (dbErr) throw dbErr
      setPhotos(next); onPhotosChange?.(clean)
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      console.error('PHOTO UPLOAD ERROR:', msg)
      setErrors(e => ({ ...e, [slot]: msg || 'Upload failed' }))
    } finally { setUploading(null) }
  }, [photos, getClient, onPhotosChange])

  const remove = useCallback(async (slot: number) => {
    const url = photos[slot]; if (!url) return
    try {
      const client = getClient()
      const { data: { session } } = await client.auth.getSession()
      const uid = session?.user?.id
      const old = url.split('/profile-photos/')[1]
      if (old) await client.storage.from('profile-photos').remove([old])
      const next = [...photos]; next[slot] = ''
      const clean = next.filter(Boolean)
      if (uid) await client.from('user_fingerprint').upsert({ id: uid, photos: clean }, { onConflict: 'id' })
      setPhotos(next); onPhotosChange?.(clean)
    } catch (err) { console.error('remove photo error', err) }
  }, [photos, getClient, onPhotosChange])

  return (
    <div style={{ width: '100%' }}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, slotRef.current); e.target.value = '' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const url = photos[i]; const busy = uploading === i; const err = errors[i]
          return (
            <div key={i} style={{ position:'relative', aspectRatio:'1', borderRadius:12, overflow:'hidden',
              border:`1.5px solid ${err ? '#f87171' : url ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.2)'}`,
              background: url ? 'transparent' : 'rgba(124,58,237,0.05)', cursor: busy ? 'wait' : 'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
              onClick={() => { if (!busy && !url) { slotRef.current = i; inputRef.current?.click() } }}>
              {url ? (
                <>
                  <img src={url} alt={`Photo ${i+1}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button onClick={e => { e.stopPropagation(); remove(i) }}
                    style={{ position:'absolute', top:6, right:6, width:24, height:24, borderRadius:'50%',
                      background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', fontSize:14,
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                </>
              ) : busy ? (
                <div style={{ color:'#9d84d0', fontSize:12, fontFamily:'system-ui,sans-serif' }}>Uploading…</div>
              ) : err ? (
                <div style={{ padding:8, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#f87171', fontFamily:'system-ui,sans-serif', lineHeight:1.3 }}>{err}</div>
                  <button onClick={e => { e.stopPropagation(); slotRef.current = i; inputRef.current?.click() }}
                    style={{ marginTop:6, fontSize:11, color:'#a78bfa', background:'transparent', border:'none', cursor:'pointer' }}>Retry</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:24, marginBottom:6 }}>📷</div>
                  <div style={{ fontSize:12, color:'#9d84d0', fontFamily:'system-ui,sans-serif' }}>Add photo</div>
                </>
              )}
            </div>
          )
        })}
      </div>
      <p style={{ margin:'12px 0 0', fontSize:11, color:'#6d4fa0', fontFamily:'system-ui,sans-serif', textAlign:'center' }}>
        Up to 3 photos · JPG, PNG, WebP · Max 5MB each
      </p>
    </div>
  )
}
