import React from 'react';
import MatchClientShell from './MatchClientShell';

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <MatchClientShell matchId={matchId} />;
}
