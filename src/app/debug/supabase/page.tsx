'use client';

import React from 'react';
import Link from 'next/link';

export default function SupabaseDebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 860 }}>
      <h1>BetterMate</h1>

      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: '0 8px' }}>·</span>
        <Link href="/debug/bm">Debug</Link>
      </div>

      <h2>Supabase environment check</h2>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <b>ENV:</b> {supabaseUrl && anonKey ? 'OK' : 'MISSING'}
        </div>

        <div style={{ marginBottom: 6 }}>
          <b>NEXT_PUBLIC_SUPABASE_URL:</b> {supabaseUrl || '(missing)'}
        </div>

        <div style={{ marginBottom: 6 }}>
          <b>NEXT_PUBLIC_SUPABASE_ANON_KEY:</b> {anonKey ? anonKey.slice(0, 10) + '…' : '(missing)'}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          This page exists to prevent “blank screen” failures during deploys by guaranteeing a valid export.
        </div>
      </div>
    </div>
  );
}
