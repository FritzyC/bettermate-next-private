import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  const url = origin ? `${origin.replace(/\/+$/, "")}/auth/v1/health` : "";

  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or key",
      hasUrl: Boolean(origin),
      hasKey: Boolean(key),
    });
  }

  try {
    const r = await fetch(url, {
      headers: {
        apikey: key,
      },
    });
    const body = await r.text();

    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      body,
      origin,
    });
  } catch (e: any) {
    return res.status(200).json({
      ok: false,
      error: String(e?.message ?? e),
      origin,
    });
  }
}
