import React from 'react';
import MatchClientShell from './MatchClientShell';

export default async function MatchPage({ params }: { params: { matchId: string } }) {
  return <MatchClientShell params={params} />;
}
