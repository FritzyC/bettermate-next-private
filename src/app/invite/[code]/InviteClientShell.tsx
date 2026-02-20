'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvite, getInvitePreview, type InvitePreview } from '@/lib/bm/invite';

export default function InviteClientShell({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const safeNext = useMemo(() => `/invite/${encodeURIComponent(token)}`, [token]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getInvitePreview(token);
        if (!alive) return;
        setPreview(data);
      } catch (e: any) {
        if (!alive) return;
        setPreview({ error: 'preview_failed' });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  async function onAccept() {
    setActionState('loading');
    setErrorMsg('');

    try {
      const { status, data } = await acceptInvite(token);

      if (status === 401 || data?.error === 'unauthorized') {
        router.push(`/auth?next=${encodeURIComponent(safeNext)}`);
        return;
      }

      if (data?.error) {
        setErrorMsg(String(data.error));
        setActionState('error');
        return;
      }

      if (!data?.ok || !data?.match_id) {
        setErrorMsg('unexpected_response');
        setActionState('error');
        return;
      }

      router.push(`/matches/${data.match_id}`);
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'network_error');
      setActionState('error');
    }
  }

  const title = 'BetterMate';

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>{title}</h1>
        <div>Loading invite…</div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>{title}</h1>
        <div>Failed to load invite.</div>
      </div>
    );
  }

  if ('error' in preview) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>{title}</h1>
        <div>Invite error: {preview.error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 520 }}>
      <h1>{title}</h1>
      <p>
        <b>{preview.inviter_name}</b> invited you ({preview.channel}).
      </p>
      <p>Status: {preview.status}</p>

      {actionState === 'error' && (
        <div style={{ marginTop: 12, padding: 12, background: '#fee', border: '1px solid #fbb' }}>
          Failed: {errorMsg}
        </div>
      )}

      <button
        onClick={onAccept}
        disabled={actionState === 'loading'}
        style={{ marginTop: 12, padding: '10px 14px' }}
      >
        {actionState === 'loading' ? 'Accepting…' : 'Accept Invite'}
      </button>
    </div>
  );
}
