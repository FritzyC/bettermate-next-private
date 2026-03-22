import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export function useOnboardingGuard() {
  const router = useRouter();
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    (async () => {
      // Get session from localStorage
      let session = (await supabase.auth.getSession()).data.session
      if (!session && typeof window !== 'undefined') {
        const lsKey = Object.keys(localStorage).find(k => k.includes('auth-token'))
        if (lsKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(lsKey) ?? '{}')
            if (parsed?.access_token) {
              const { data } = await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token ?? ''
              })
              session = data.session
            }
          } catch {}
        }
      }

      if (!session) return

      const userEmail = (session.user.email ?? '').toLowerCase()
      const isAdmin = ADMIN_EMAILS.includes(userEmail)

      // Check invite gate for non-admins
      if (!isAdmin) {
        const { data: acceptedInvite } = await supabase
          .from('invites')
          .select('id')
          .eq('accepted_by_user_id', session.user.id)
          .eq('status', 'accepted')
          .maybeSingle()

        if (!acceptedInvite) {
          router.replace('/request-access')
          return
        }
      }

      // Check onboarding completion
      const { data: fp } = await supabase
        .from('user_fingerprint')
        .select('onboarding_complete')
        .eq('id', session.user.id)
        .maybeSingle()

      if (fp !== null && fp.onboarding_complete === false) {
        router.replace('/onboarding')
      }
    })()
  }, [router])
}
