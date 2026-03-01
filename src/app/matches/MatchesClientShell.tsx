'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

export default function MatchesClientShell() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      router.replace('/auth?next=/matches');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/auth?next=/matches');
        return;
      }

      setUserEmail(session.user.email ?? null);

      supabase
        .from('matches')
        .select('*')
        .or(`user_a_id.eq.${session.user.id},user_b_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setMatches(data);
          setLoading(false);
        });
    });
  }, [router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui',
        color: '#fff',
      }}>
        Loading matches…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Your Matches</h1>
          <span style={{ color: '#666', fontSize: 14 }}>{userEmail}</span>
        </div>

        {matches.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            background: '#111',
            borderRadius: 16,
            border: '1px solid #222',
          }}>
            <p style={{ fontSize: 18, color: '#888', marginBottom: 16 }}>No matches yet</p>
            
              href="/invite/create"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: '#6366f1',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Create an Invite
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {matches.map((match) => (
              
                key={match.id}
                href={`/matches/${match.id}`}
                style={{
                  display: 'block',
                  padding: 20,
                  background: '#111',
                  borderRadius: 12,
                  border: '1px solid #222',
                  textDecoration: 'none',
                  color: '#fff',
                }}
              >
                <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>Match</div>
                <div style={{ fontWeight: 600 }}>#{match.id?.slice(0, 8)}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
                  {new Date(match.created_at).toLocaleDateString()}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}