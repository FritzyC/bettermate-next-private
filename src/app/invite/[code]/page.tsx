import InviteClientShell from "./InviteClientShell";

function normalizeInviteToken(raw: string): string {
  const s = (raw ?? "").trim();
  // If the URL accidentally includes extra characters (like a trailing '.'), extract the first 64-hex token.
  const m = s.match(/[0-9a-f]{64}/i);
  return m ? m[0].toLowerCase() : s;
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const token = normalizeInviteToken(code);
  return <InviteClientShell code={token} />;
}
