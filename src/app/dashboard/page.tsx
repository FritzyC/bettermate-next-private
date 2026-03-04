'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';

export default function DashboardPage() {
  const router = useRouter();
  useOnboardingGuard();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { router.replace('/auth'); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth?next=/dashboard'); return; }
      setUser(session.user);
      setLoading(false);
    });
  }, [router]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', fontFamily: 'system-ui', background: '#0a0a0a' }}>
      Loading...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui', padding: '40px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Dashboard</h1>
        <p style={{ color: '#888' }}>{user?.email}</p>
        <div style={{ marginTop: 32, display: 'flex', gap: 16 }}>
          <a href="/matches" style={{ padding: '12px 24px', background: '#6366f1', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>View Matches</a>
          <a href="/invite/create" style={{ padding: '12px 24px', background: '#1a1a1a', color: '#fff', borderRadius: 8, textDecoration: 'none', border: '1px solid #333' }}>Create Invite</a>
        </div>
      </div>
    </div>
  );
}
