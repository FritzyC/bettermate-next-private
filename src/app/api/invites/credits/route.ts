import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!bearer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const admin = await getSupabaseAdmin();
    const { data: userData } = await admin.auth.getUser(bearer);
    const user = userData?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data } = await admin.from("user_fingerprint").select("invite_credits").eq("id", user.id).maybeSingle();
    return NextResponse.json({ credits: data?.invite_credits ?? 0 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as { message?: string })?.message ?? "error" }, { status: 500 });
  }
}
