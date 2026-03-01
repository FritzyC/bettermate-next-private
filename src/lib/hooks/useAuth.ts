import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      router.push('/auth');
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth');
        setLoading(false);
        return;
      }

      setUser(session.user);
      setSession(session);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setSession(session);
      } else {
        setUser(null);
        setSession(null);
        router.push('/auth');
      }
    });

    return () => subscription?.unsubscribe();
  }, [router]);

  return { user, session, loading };
}