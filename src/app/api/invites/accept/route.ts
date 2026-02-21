import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function getBearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function normalizeRpcData(raw: any): any {
  // Supabase can sometimes return an array depending on function shape
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

async function acceptInviteRpc(client: any, token: string, userId: string) {
  // Our canonical RPC signature (confirmed):
  // public.accept_invite(p_token text, p_user_id uuid) returns jsonb
  const params = { p_token: token, p_user_id: userId };
  const { data, error } = await client.rpc("accept_invite", params as any);
  return { data, error, attempt: "p_token+p_user_id" as const };
}

export async function POST(req: NextRequest) {
  const debug = process.env.NEXT_PUBLIC_BM_DEBUG === "1";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!isNonEmptyString(supabaseUrl) || !isNonEmptyString(publicKey)) {
    return json({ error: "missing_supabase_public_env" }, 500);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const token = body?.token;
  if (!isNonEmptyString(token)) {
    return json({ error: "bad_request", detail: "missing_token" }, 400);
  }

  const bearer = getBearer(req);
  if (!bearer) {
    return json(
      { error: "unauthorized", detail: "Auth session missing!", cookie_names: [], bearer_present: false },
      401
    );
  }

  // Use anon key + user bearer (no service role required)
  const client = createClient<any>(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  // Validate bearer and get user id (explicit token)
  const { data: u, error: uErr } = await client.auth.getUser(bearer);
  const user = u?.user;

  if (uErr || !user?.id) {
    return json(
      {
        error: "unauthorized",
        detail: debug ? (uErr?.message || "Auth session missing!") : "unauthorized",
        cookie_names: [],
        bearer_present: true,
      },
      401
    );
  }

  const userId = user.id;

  // RPC
  const { data: rawRpcData, error: rpcErr, attempt } = await acceptInviteRpc(client, token, userId);

  if (rpcErr) {
    return json(
      {
        error: "rpc_error",
        detail: debug
          ? {
              code: (rpcErr as any)?.code ?? null,
              message: (rpcErr as any)?.message ?? String(rpcErr),
              hint: (rpcErr as any)?.hint ?? null,
              details: (rpcErr as any)?.details ?? null,
            }
          : "rpc_error",
        code: (rpcErr as any)?.code ?? null,
        attempt: debug ? attempt : undefined,
      },
      500
    );
  }

  const rpcData = normalizeRpcData(rawRpcData);

  // ✅ If RPC returns a domain error like { error: "cannot_accept_own_invite" }, pass it through cleanly.
  if (rpcData && typeof rpcData === "object" && isNonEmptyString((rpcData as any).error)) {
    // Best-effort behavior log for failure (do not fail response if log insert fails)
    try {
      const dedup_key = `invite_accept_fail:${userId}:${token}`;
      await client
        .from("behavior_events")
        .upsert(
          [
            {
              dedup_key,
              event_type: "invite.accept_failed",
              source: "api/invites/accept",
              created_at: new Date().toISOString(),
              user_id: userId,
              invite_id: (rpcData as any).invite_id ?? null,
              match_id: (rpcData as any).match_id ?? null,
              metadata: {
                reason: (rpcData as any).error,
                token_prefix: token.slice(0, 8),
                token_len: token.length,
              },
            },
          ],
          { onConflict: "dedup_key", ignoreDuplicates: true }
        );
    } catch {}

    return json(
      {
        error: (rpcData as any).error,
        detail: (rpcData as any).detail ?? null,
      },
      400
    );
  }

  // Normalize success return
  const matchId =
    typeof rpcData === "string" ? rpcData : (rpcData as any)?.match_id ?? (rpcData as any)?.matchId ?? null;

  const inviteId = (rpcData as any)?.invite_id ?? (rpcData as any)?.inviteId ?? null;
  const idempotent = Boolean((rpcData as any)?.idempotent);

  if (!isNonEmptyString(matchId)) {
    return json({ error: "unexpected_rpc_shape", detail: debug ? rpcData : null }, 500);
  }

  // Best-effort behavior log (do not fail accept if insert fails)
  try {
    const dedup_key = `invite_accept:${userId}:${token}`;
    await client
      .from("behavior_events")
      .upsert(
        [
          {
            dedup_key,
            event_type: "invite.accepted",
            source: "api/invites/accept",
            created_at: new Date().toISOString(),
            user_id: userId,
            invite_id: inviteId,
            match_id: matchId,
            metadata: { token_prefix: token.slice(0, 8), token_len: token.length },
          },
        ],
        { onConflict: "dedup_key", ignoreDuplicates: true }
      );
  } catch {}

  return json({ ok: true, match_id: matchId, invite_id: inviteId ?? null, idempotent });
}

export async function GET() {
  return json({ error: "method_not_allowed" }, 405);
}
