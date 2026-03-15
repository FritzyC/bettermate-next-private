import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { matchId } = await req.json();
  if (!matchId) return NextResponse.json({ error: "missing_match_id" }, { status: 400 });

  const admin = await getSupabaseAdmin();
  const { data: match } = await admin.from("matches").select("id, user_a_id, user_b_id, on_hold_at").eq("id", matchId).single();
  if (!match) return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  if (match.user_a_id !== user.id && match.user_b_id !== user.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: 499,
    currency: "usd",
    metadata: {
      user_id: user.id,
      match_id: matchId,
      purchase_type: "match_reactivation",
      app_env: process.env.NODE_ENV || "production",
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, amount: 499 });
}
