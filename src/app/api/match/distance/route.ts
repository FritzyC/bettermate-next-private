import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function zipToCoords(zip: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${zip}&key=${key}`;
  const res = await fetch(url);
  const json = await res.json();
  const loc = json?.results?.[0]?.geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  const userId = searchParams.get("userId");
  if (!matchId || !userId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!bearer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = await getSupabaseAdmin();
  const { data: authUser } = await admin.auth.getUser(bearer);
  if (!authUser?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: match } = await admin.from("matches").select("user_a_id, user_b_id").eq("id", matchId).single();
  if (!match) return NextResponse.json({ error: "match_not_found" }, { status: 404 });

  const otherUserId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;

  const [{ data: myFp }, { data: theirFp }] = await Promise.all([
    admin.from("user_fingerprint").select("zip_code, location_lat, location_lng").eq("id", userId).single(),
    admin.from("user_fingerprint").select("zip_code, location_lat, location_lng").eq("id", otherUserId).single(),
  ]);

  let myCoords = myFp?.location_lat ? { lat: myFp.location_lat, lng: myFp.location_lng } : null;
  let theirCoords = theirFp?.location_lat ? { lat: theirFp.location_lat, lng: theirFp.location_lng } : null;

  if (!myCoords && myFp?.zip_code) {
    myCoords = await zipToCoords(myFp.zip_code);
    if (myCoords) await admin.from("user_fingerprint").update({ location_lat: myCoords.lat, location_lng: myCoords.lng, location_updated_at: new Date().toISOString() }).eq("id", userId);
  }
  if (!theirCoords && theirFp?.zip_code) {
    theirCoords = await zipToCoords(theirFp.zip_code);
    if (theirCoords) await admin.from("user_fingerprint").update({ location_lat: theirCoords.lat, location_lng: theirCoords.lng, location_updated_at: new Date().toISOString() }).eq("id", otherUserId);
  }

  if (!myCoords || !theirCoords) {
    return NextResponse.json({ ok: true, distance_miles: null, within_50: null, coords_available: false });
  }

  const miles = haversineMiles(myCoords.lat, myCoords.lng, theirCoords.lat, theirCoords.lng);
  const within50 = miles <= 50;

  return NextResponse.json({ ok: true, distance_miles: Math.round(miles), within_50: within50, coords_available: true });
}
