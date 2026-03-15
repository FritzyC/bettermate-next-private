import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!bearer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const admin = await getSupabaseAdmin();
    const { data: userData } = await admin.auth.getUser(bearer);
    const user = userData?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: fp } = await admin
      .from("user_fingerprint")
      .select("invite_credits, onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

    if (!fp?.onboarding_complete) {
      return NextResponse.json({ error: "onboarding_not_complete" }, { status: 400 });
    }

    const alreadyHasCredits = (fp?.invite_credits ?? 0) > 0;

    if (!alreadyHasCredits) {
      await admin
        .from("user_fingerprint")
        .update({ invite_credits: 2 })
        .eq("id", user.id);

      try { await admin.from("behavior_events").insert({ event_type: "invite_credits_granted", user_id: user.id, payload: { credits: 2, reason: "onboarding_completed" }, created_at: new Date().toISOString() }); } catch (_) {}
    }

    try { await admin.from("behavior_events").insert({ event_type: "user_activated", user_id: user.id, payload: { already_had_credits: alreadyHasCredits }, created_at: new Date().toISOString() }); } catch (_) {}

    return NextResponse.json({ ok: true, credits_granted: !alreadyHasCredits });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as { message?: string })?.message ?? "error" }, { status: 500 });
  }
}
