import type { NextApiRequest, NextApiResponse } from "next";

function safeOrigin(url: string): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const origin = safeOrigin(supabaseUrl);

  if (!origin || !anonKey) {
    res.status(500).json({
      ok: false,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      origin,
      hasAnonKey: Boolean(anonKey),
    });
    return;
  }

  try {
    const r = await fetch(`${origin}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
    });

    const text = await r.text();

    res.status(200).json({
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      body: text.slice(0, 1500),
      origin,
    });
  } catch (e: any) {
    res.status(200).json({
      ok: false,
      error: e?.message ? String(e.message) : String(e),
      origin,
    });
  }
}
