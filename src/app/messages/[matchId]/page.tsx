import React from 'react';
import MatchClientShell from '@/app/matches/[matchId]/MatchClientShell';

export default async function MessagesPage({ params }: { params: { matchId: string } }) {
  return <MatchClientShell params={params} />;
}
