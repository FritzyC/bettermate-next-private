import MatchClientShell from '@/app/matches/[matchId]/MatchClientShell';

export default async function MessagesMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <MatchClientShell matchId={matchId} />;
}
