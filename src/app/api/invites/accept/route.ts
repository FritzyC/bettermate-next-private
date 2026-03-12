import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const body = await req.json();
    const token = body.token || body.p_token || body.code;

    if (!token) {
      return NextResponse.json({ error: "invalid_token", code: "invalid_token" }, { status: 400 });
    }

    let user = (await supabase.auth.getUser()).data.user ?? null;

    // Fallback: try bearer token from Authorization header
    if (!user) {
      const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
      if (bearer) {
        const admin = await getSupabaseAdmin();
        const { data } = await admin.auth.getUser(bearer);
        user = data.user ?? null;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("accept_invite", {
      p_token: token,
      p_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message, code: "rpc_error" }, { status: 400 });
    }

    if (data?.ok === true) {
      // Grant new user 2 invite credits
      const admin = await getSupabaseAdmin();
      await admin.from('user_fingerprint')
        .update({ invite_credits: 2 })
        .eq('id', user.id);
      return NextResponse.json({ ok: true, match_id: data.match_id, idempotent: !!data.idempotent });
    }

    return NextResponse.json({ ok: false, error: data?.error || "accept_failed" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "exception" }, { status: 500 });
  }
}
