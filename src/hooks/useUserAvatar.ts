import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

interface AvatarData { photoUrl: string | null; displayName: string | null; loading: boolean }

export function useUserAvatar(userId: string | null | undefined): AvatarData {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: fp }, { data: profile }] = await Promise.all([
          supabase.from('user_fingerprint').select('photos').eq('id', userId).maybeSingle(),
          supabase.from('profiles').select('full_name,display_name,email').eq('id', userId).maybeSingle(),
        ])
        if (!cancelled) {
          setPhotoUrl(((fp?.photos ?? []) as string[])[0] ?? null)
          setDisplayName(profile?.full_name ?? profile?.display_name ?? (profile?.email?.split('@')?.[0] ?? null))
        }
      } catch (e) { console.error('useUserAvatar', e) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  return { photoUrl, displayName, loading }
}
