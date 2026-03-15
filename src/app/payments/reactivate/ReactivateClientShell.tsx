"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

export default function ReactivateClientShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams?.get("matchId") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleReactivate() {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      if (!sb) { setError("Not authenticated"); return; }
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/auth?next=/payments/reactivate?matchId=" + matchId); return; }

      const res = await fetch("/api/payments/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
        body: JSON.stringify({ matchId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError(json.error ?? "Payment failed"); return; }

      setDone(true);
      setTimeout(() => router.replace("/matches/" + matchId), 2000);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "error");
    } finally {
      setLoading(false);
    }
  }

  const gold = "#C9A96E";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a041a 0%, #10062a 50%, #0a041a 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(219,39,119,0.07) 100%)", border: "1px solid rgba(124,58,237,0.28)", borderRadius: 20, padding: "40px 32px", maxWidth: 420, width: "100%", textAlign: "center" }}>

        {done ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✨</div>
            <h2 style={{ color: gold, fontSize: 20, margin: "0 0 12px" }}>Connection reactivated.</h2>
            <p style={{ color: "#9d84d0", fontSize: 14 }}>Taking you back to your match...</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔄</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>Reactivate this connection</h1>
            <p style={{ color: "#9d84d0", fontSize: 14, lineHeight: 1.7, margin: "0 0 32px" }}>
              This match is on hold. Reactivating restores your connection and opens a new planning window.
            </p>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
              <p style={{ color: gold, fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>$4.99</p>
              <p style={{ color: "#7A6A96", fontSize: 12, margin: 0 }}>One-time · No recurring charges</p>
            </div>
            {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{error}</p>}
            <button onClick={handleReactivate} disabled={loading}
              style={{ width: "100%", background: loading ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #7c3aed, #db2777)", color: loading ? "#555" : "#fff", border: "none", borderRadius: 12, padding: "16px 24px", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "Georgia, serif", marginBottom: 12 }}>
              {loading ? "Processing..." : "Reactivate — $4.99"}
            </button>
            <a href={"/matches/" + matchId} style={{ color: "#7A6A96", fontSize: 12, textDecoration: "underline" }}>
              Go back
            </a>
          </>
        )}
      </div>
    </div>
  );
}
