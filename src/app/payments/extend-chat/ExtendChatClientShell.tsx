"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

const DAYS_OPTIONS = [
  { days: 1, price: "$0.99", label: "1 day" },
  { days: 3, price: "$2.97", label: "3 days" },
  { days: 7, price: "$6.93", label: "7 days" },
];

export default function ExtendChatClientShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams?.get("matchId") ?? "";
  const [selectedDays, setSelectedDays] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleExtend() {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      if (!sb) { setError("Not authenticated"); return; }
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/auth?next=/payments/extend-chat?matchId=" + matchId); return; }

      const res = await fetch("/api/payments/extend-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
        body: JSON.stringify({ matchId, days: selectedDays }),
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
  const selected = DAYS_OPTIONS.find(o => o.days === selectedDays)!;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a041a 0%, #10062a 50%, #0a041a 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(219,39,119,0.07) 100%)", border: "1px solid rgba(124,58,237,0.28)", borderRadius: 20, padding: "40px 32px", maxWidth: 420, width: "100%", textAlign: "center" }}>

        {done ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✨</div>
            <h2 style={{ color: gold, fontSize: 20, margin: "0 0 12px" }}>Chat extended.</h2>
            <p style={{ color: "#9d84d0", fontSize: 14 }}>Taking you back to your match...</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>💬</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Keep this connection alive</h1>
            <p style={{ color: "#9d84d0", fontSize: 14, lineHeight: 1.7, margin: "0 0 28px" }}>
              You are not close enough to meet yet. Extend your chat window to keep building this connection.
            </p>

            <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
              {DAYS_OPTIONS.map(opt => (
                <button key={opt.days} onClick={() => setSelectedDays(opt.days)}
                  style={{ flex: 1, background: selectedDays === opt.days ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.03)", border: "1px solid " + (selectedDays === opt.days ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"), borderRadius: 12, padding: "14px 8px", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ color: selectedDays === opt.days ? "#c4b5fd" : "#7A6A96", fontSize: 13, fontWeight: 700, margin: "0 0 4px", fontFamily: "Georgia, serif" }}>{opt.label}</p>
                  <p style={{ color: selectedDays === opt.days ? gold : "#555", fontSize: 12, margin: 0, fontFamily: "system-ui, sans-serif" }}>{opt.price}</p>
                </button>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 12, padding: "14px 20px", marginBottom: 24 }}>
              <p style={{ color: gold, fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>{selected.price}</p>
              <p style={{ color: "#7A6A96", fontSize: 12, margin: 0 }}>
                {selected.label} · No recurring charges · Cancel anytime by letting it expire
              </p>
            </div>

            {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{error}</p>}

            <button onClick={handleExtend} disabled={loading}
              style={{ width: "100%", background: loading ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #7c3aed, #db2777)", color: loading ? "#555" : "#fff", border: "none", borderRadius: 12, padding: "16px 24px", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "Georgia, serif", marginBottom: 12 }}>
              {loading ? "Processing..." : `Extend Chat — ${selected.price}`}
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
