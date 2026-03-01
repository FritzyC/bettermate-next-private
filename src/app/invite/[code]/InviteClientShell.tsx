"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

export default function InviteClientShell({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("Loading invite...");
  const [error, setError] = useState<string | null>(null);

  async function acceptInvite() {
    setStatus("Accepting invite...");
    const supabase = getSupabase();
    if (!supabase) { setError("Not authenticated"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth?next=/invite/" + code); return; }

    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: code }),
    });
    const json = await res.json();
    if (json.ok) {
      router.replace("/matches/" + json.match_id);
    } else {
      setError(json.error || "Failed to accept invite");
    }
  }

  useEffect(() => {
    setStatus("Ready to accept invite");
  }, [code]);

  if (error) return (
    <div style={{ padding: 40, color: "#fff", fontFamily: "system-ui", textAlign: "center" }}>
      <h2>Error</h2><p style={{ color: "#f87171" }}>{error}</p>
      <a href="/" style={{ color: "#6366f1" }}>Go home</a>
    </div>
  );

  return (
    <div style={{ padding: 40, color: "#fff", fontFamily: "system-ui", textAlign: "center", minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>You got an invite!</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>{status}</p>
      <button
        onClick={acceptInvite}
        style={{ padding: "14px 32px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
      >
        Accept Invite
      </button>
    </div>
  );
}
