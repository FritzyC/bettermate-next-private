import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function getBearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function normalizeRpcData(raw: any): any {
  if (Array.isArray(raw)) return raw[0] ?? null;
  // Some wrappers can show up depending on how it's called
  if (raw && typeof raw === "object" && "data" in raw && raw.data) return raw.data;
  return raw;
}

async function acceptInviteRpc(client: any, token: string, userId: string) {
  const attempts: Array<{ attempt: string; params: Record<string, any> }> = [
    { attempt: "p_token+p_user_id", params: { p_token: token, p_user_id: userId } },
    { attempt: "token+user_id", params: { token, user_id: userId } },
    { attempt: "invite_token+accepting_user_id", params: { invite_token: token, accepting_user_id: userId } },
  ];

  let lastErr: any = null;
  let lastAttempt: string | null = null;

  for (const a of attempts) {
    const { data, error } = await (client as any).rpc("accept_invite", a.params as any);
    if (!error) return { data, error: null, attempt: a.attempt };
    lastErr = error;
    lastAttempt = a.attempt;
  }

  return { data: null, error: lastErr, attempt: lastAttempt };
}

export async function POST(req: NextRequest) {
  const debug = process.env.NEXT_PUBLIC_BM_DEBUG === "1" || process.env.NEXT_PUBLIC_BM_DEBUG === "true";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!isNonEmptyString(supabaseUrl) || !isNonEmptyString(anonKey)) {
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

  // Auth source preference:
  // 1) Authorization: Bearer <access_token> (from client localStorage)
  // 2) Supabase SSR cookies (works on Vercel + browser sessions)
  const bearer = getBearer(req);

  let authSource: "bearer" | "cookie" | "none" = "none";
  let client: any = null;
  let userId: string | null = null;

  if (bearer) {
    authSource = "bearer";
    client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });

    const { data: u, error: uErr } = await client.auth.getUser(bearer);
    if (uErr || !u?.user?.id) {
      return json(
        {
          error: "unauthorized",
          detail: debug ? (uErr?.message || "unauthorized") : "unauthorized",
          bearer_present: true,
          auth_source: authSource,
        },
        401
      );
    }
    userId = u.user.id;
  } else {
    authSource = "cookie";
    const cookieStore = await cookies();

    client = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) cookieStore.set(c.name, c.value, c.options as any);
        },
      },
    });

    const { data: u, error: uErr } = await client.auth.getUser();
    if (uErr || !u?.user?.id) {
      return json(
        {
          error: "unauthorized",
          detail: debug ? (uErr?.message || "Auth session missing!") : "unauthorized",
          bearer_present: false,
          auth_source: authSource,
        },
        401
      );
    }
    userId = u.user.id;
  }

  try {
    const { data: rawRpcData, error: rpcErr, attempt } = await acceptInviteRpc(client, token, userId);

    if (rpcErr) {
      return json(
        {
          error: "rpc_error",
          detail: debug
            ? {
                code: rpcErr?.code ?? null,
                message: rpcErr?.message ?? String(rpcErr),
                hint: rpcErr?.hint ?? null,
                details: rpcErr?.details ?? null,
              }
            : "rpc_error",
          code: rpcErr?.code ?? null,
          attempt: debug ? attempt : undefined,
          auth_source: authSource,
        },
        500
      );
    }

    const rpcData = normalizeRpcData(rawRpcData);

    // Domain errors from the RPC: { error: 'cannot_accept_own_invite' } etc.
    if (rpcData?.error) {
      return json(
        {
          error: String(rpcData.error),
          detail: debug ? rpcData : null,
          auth_source: authSource,
        },
        400
      );
    }

    const matchId =
      typeof rpcData === "string"
        ? rpcData
        : rpcData?.match_id ?? rpcData?.matchId ?? null;

    const inviteId =
      rpcData?.invite_id ?? rpcData?.inviteId ?? null;

    const idempotent = Boolean(rpcData?.idempotent);

    if (!matchId) {
      return json({ error: "unexpected_rpc_shape", detail: debug ? rpcData : null, auth_source: authSource }, 500);
    }

    // Best-effort behavior log (safe via dedup_key unique)
    try {
      const dedup_key = `invite_accept:${userId}:${token}`;
      await client.from("behavior_events").upsert(
        [
          {
            dedup_key,
            event_type: "invite.accepted.api",
            source: "api/invites/accept",
            created_at: new Date().toISOString(),
            user_id: userId,
            invite_id: inviteId,
            match_id: matchId,
            metadata: { token_prefix: token.slice(0, 8), token_len: token.length, auth_source: authSource },
          },
        ],
        { onConflict: "dedup_key", ignoreDuplicates: true }
      );
    } catch {}

    return json({ ok: true, match_id: matchId, invite_id: inviteId ?? null, idempotent });
  } catch (e: any) {
    return json({ error: "internal_error", detail: debug ? (e?.message ?? String(e)) : null }, 500);
  }
}

export async function GET() {
  return json({ error: "method_not_allowed" }, 405);
}
