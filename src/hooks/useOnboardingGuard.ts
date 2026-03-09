import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

export function useOnboardingGuard() {
  const router = useRouter();
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // let existing auth guard handle this
      const { data: fp } = await supabase
        .from('user_fingerprint')
        .select('onboarding_complete')
        .eq('id', session.user.id)
        .maybeSingle();
      // Only redirect if row exists AND onboarding_complete is explicitly false
      if (fp !== null && fp.onboarding_complete === false) {
        router.replace('/onboarding');
      }
    })();
  }, [router]);
}
