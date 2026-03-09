'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

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

  const upload = useCallback(async (file: File, slot: number) => {
    // Verify session exists before upload
    const { data: { session } } = await supabase.auth.getSession()
    console.log('PHOTO UPLOAD userId:', userId, 'session uid:', session?.user?.id, 'file:', file.name)
    if (!session) { setErrors(e => ({ ...e, [slot]: 'Not signed in — please refresh' })); return }
    if (!ALLOWED.includes(file.type)) { setErrors(e => ({ ...e, [slot]: 'JPG, PNG or WebP only' })); return }
    if (file.size > MAX_SIZE) { setErrors(e => ({ ...e, [slot]: 'Max 5MB' })); return }
    setUploading(slot); setErrors(e => { const n = { ...e }; delete n[slot]; return n })
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/${Date.now()}_${slot}.${ext}`
      if (photos[slot]) {
        const old = photos[slot].split('/profile-photos/')[1]
        if (old) await supabase.storage.from('profile-photos').remove([old])
      }
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path)
      const next = [...photos]; next[slot] = publicUrl
      const clean = next.filter(Boolean)
      const { error: dbErr } = await supabase.from('user_fingerprint').update({ photos: clean }).eq('id', userId)
      if (dbErr) throw dbErr
      setPhotos(next); onPhotosChange?.(clean)
    } catch (err) {
      console.error('PHOTO UPLOAD ERROR:', err)
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      setErrors(e => ({ ...e, [slot]: msg || 'Upload failed' }))
    } finally { setUploading(null) }
  }, [photos, userId, onPhotosChange])

  const remove = useCallback(async (slot: number) => {
    const url = photos[slot]; if (!url) return
    try {
      const old = url.split('/profile-photos/')[1]
      if (old) await supabase.storage.from('profile-photos').remove([old])
      const next = [...photos]; next[slot] = ''
      const clean = next.filter(Boolean)
      await supabase.from('user_fingerprint').update({ photos: clean }).eq('id', userId)
      setPhotos(next); onPhotosChange?.(clean)
      } catch (err) { console.error('remove photo error', err) }
  }, [photos, userId, onPhotosChange])

  return (
    <div style={{ width: '100%' }}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, slotRef.current); e.target.value = '' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const url = photos[i]; const busy = uploading === i; const err = errors[i]
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div onClick={() => { if (!busy) { slotRef.current = i; inputRef.current?.click() } }}
                style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden',
                  border: url ? '2px solid rgba(124,58,237,0.4)' : i === 0 ? '2px dashed #7c3aed' : '2px dashed rgba(124,58,237,0.25)',
                  background: 'rgba(124,58,237,0.04)', cursor: busy ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {url && !busy ? <>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={e => { e.stopPropagation(); remove(i) }}
                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  {i === 0 && <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(124,58,237,0.85)', color: '#fff', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20 }}>Main</div>}
                </> : busy ? <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 28, height: 28, border: '2px solid rgba(124,58,237,0.2)',
                    borderTop: '2px solid #7c3aed', borderRadius: '50%', margin: '0 auto 6px',
                    animation: 'bm-spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 11, color: '#c4b5fd' }}>Uploading…</span>
                </div> : <div style={{ textAlign: 'center', padding: 8 }}>
                  <div style={{ fontSize: 24, marginBottom: 4, opacity: i === 0 ? 1 : 0.4 }}>{i === 0 ? '📷' : '+'}</div>
                  <span style={{ fontSize: 11, color: i === 0 ? '#c4b5fd' : 'rgba(196,181,253,0.4)' }}>
                    {i === 0 ? 'Add photo' : 'Add'}
                  </span>
                </div>}
              </div>
              {err && <p style={{ margin: 0, fontSize: 10, color: '#f87171', textAlign: 'center' }}>{err}</p>}
            </div>
          )
        })}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: 'rgba(196,181,253,0.45)', textAlign: 'center' }}>
        Up to 3 photos · JPG, PNG, WebP · Max 5MB each
      </p>
      <style>{'@keyframes bm-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
