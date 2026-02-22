'use client';

import dynamic from 'next/dynamic';

const AuthClient = dynamic(() => import('./AuthClient'), {
  ssr: false,
  loading: () => (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1>BetterMate Login</h1>
      <div>Loading…</div>
    </main>
  ),
});

export default function AuthClientShell() {
  return <AuthClient />;
}
