import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

async function getInvitePreviewRpc(client: any, token: string) {
  // Be tolerant to arg name drift; prefer the real signature first.
  const attempts = [
    { attempt: "p_token", params: { p_token: token } },
    { attempt: "token", params: { token } },
    { attempt: "invite_token", params: { invite_token: token } },
    { attempt: "code", params: { code: token } },
  ];

  let last: any = null;
  let lastAttempt = attempts[0].attempt;

  for (const a of attempts) {
    const { data, error } = await client.rpc("get_invite_preview", a.params);
    if (!error) return { data, error: null, attempt: a.attempt };
    last = error;
    lastAttempt = a.attempt;
  }

  return { data: null, error: last, attempt: lastAttempt };
}

export async function GET(req: NextRequest) {
  const debug = process.env.NEXT_PUBLIC_BM_DEBUG === "1";

  const sp = req.nextUrl.searchParams;
  const token = sp.get("token") || sp.get("code") || sp.get("t");

  if (!isNonEmptyString(token)) {
    return json({ error: "bad_request", detail: "missing_token" }, 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !publicKey) {
    return json({ error: "missing_supabase_public_env" }, 500);
  }

  // No cookies/session needed for preview (RPC is SECURITY DEFINER).
  const client = createClient<any>(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error, attempt } = await getInvitePreviewRpc(client, token);

  if (error) {
    return json(
      {
        error: "rpc_error",
        detail: debug
          ? {
              code: error?.code ?? null,
              message: error?.message ?? String(error),
              hint: error?.hint ?? null,
              details: error?.details ?? null,
            }
          : "rpc_error",
        code: error?.code ?? null,
        attempt: debug ? attempt : undefined,
      },
      500
    );
  }

  // Domain error passthrough (keep as 200 so client can render the message).
  if (data?.error && !data?.ok) {
    return json({ error: String(data.error) }, 200);
  }

  // Normalize expected shape for InviteClientShell
  const inviter_name = data?.inviter_name ?? data?.inviterName ?? "Someone";
  const channel = data?.channel ?? "link";
  const status = data?.status ?? "pending";

  return json({
    inviter_name,
    channel,
    status,
    ok: true,
    // keep extra fields if present (useful for later debugging/UI)
    invite_id: data?.invite_id ?? data?.inviteId ?? null,
    inviter_email: data?.inviter_email ?? null,
    expires_at: data?.expires_at ?? null,
  });
}

export async function POST() {
  return json({ error: "method_not_allowed" }, 405);
}
