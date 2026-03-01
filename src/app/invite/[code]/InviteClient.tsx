'use client';

import React from 'react';
import InviteClientShell from './InviteClientShell';

export default function InviteClient(props: { code?: string; token?: string }) {
  const token = props.token ?? props.code ?? '';

  if (!token) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>BetterMate</h1>
        <div>Invite error: missing_token</div>
      </div>
    );
  }

  return <InviteClientShell code={token} />;
}
