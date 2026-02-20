"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { acceptInvite } from "@/lib/bm/invite";

export default function InviteClient({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("Checking session…");

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setStatus("Supabase client not ready.");
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        localStorage.setItem("BM_PENDING_INVITE_CODE", code);
        router.replace(`/auth?next=${encodeURIComponent(`/invite/${code}`)}`);
        return;
      }

      try {
        setStatus("Accepting invite…");
        const res = await acceptInvite(supabase, code);
        setStatus("Accepted. Redirecting…");
        router.replace(`/debug/bm?invite_accepted=1&matchId=${encodeURIComponent(res.matchId)}`);
      } catch (e: any) {
        setStatus(`Failed: ${e?.message ?? "unknown error"}`);
      }
    })();
  }, [router, code]);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>BetterMate</h1>
      <p>{status}</p>
    </main>
  );
}
