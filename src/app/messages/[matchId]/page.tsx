import React from 'react';
import MatchClientShell from '@/app/matches/[matchId]/MatchClientShell';

export default async function MessagesPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <MatchClientShell matchId={matchId} />;
}
