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
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!fp?.onboarding_complete) {
        router.replace('/onboarding');
      }
    })();
  }, [router]);
}
