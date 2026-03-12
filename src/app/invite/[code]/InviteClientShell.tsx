"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { colors } from "@/lib/bm/tokens";

interface Preview {
  inviter_name: string;
  channel: string;
  status: string;
  expires_at: string | null;
}

export default function InviteClientShell({ code }: { code: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-accept if user is already authenticated
    const supabase = getSupabase()
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) handleAccept()
      })
    }
  }, [code])

  useEffect(() => {
    fetch("/api/invites/preview?token=" + code)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPreview(d);
        else setLoadError(d.error ?? "Invalid invite");
      })
      .catch(() => setLoadError("Could not load invite"));
  }, [code]);

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    const supabase = getSupabase();
    if (!supabase) { setAcceptError("Not authenticated"); setAccepting(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/auth?next=/invite/" + code);
      return;
    }
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: code }),
    });
    const json = await res.json();
    if (json.ok) {
      router.replace("/matches/" + json.match_id);
    } else {
      setAcceptError(json.error ?? "Failed to accept invite");
      setAccepting(false);
    }
  }

  const gold = "#C9A96E";
  const bg: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #0a041a 0%, #10062a 50%, #0a041a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    fontFamily: "Georgia, serif",
  };

  if (loadError) return (
    <div style={{ ...bg, textAlign: "center" }}>
      <p style={{ color: "#f87171", fontSize: 16, marginBottom: 24 }}>{loadError}</p>
      <a href="/" style={{ color: gold, fontSize: 14 }}>Go to BetterMate</a>
    </div>
  );

  if (!preview) return (
    <div style={{ ...bg, textAlign: "center", color: colors.textMuted, fontSize: 14 }}>
      Loading invite...
    </div>
  );

  if (preview.status === "accepted") return (
    <div style={{ ...bg, textAlign: "center" }}>
      <h2 style={{ color: colors.textPrimary, fontSize: 22, margin: "0 0 12px" }}>This invite has already been used.</h2>
      <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 28px" }}>Each invite link can only be used once.</p>
      <a href="/" style={{ color: gold, fontSize: 14 }}>Go to BetterMate</a>
    </div>
  );

  return (
    <div style={bg}>
      {/* Logo / Brand */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #7c3aed, #db2777)", borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
          B
        </div>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>BetterMate</p>
      </div>

      {/* Card */}
      <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(219,39,119,0.08) 100%)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 20, padding: "36px 32px", maxWidth: 400, width: "100%", textAlign: "center" }}>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 8px", letterSpacing: 1, textTransform: "uppercase" }}>
          You have been invited by
        </p>
        <h1 style={{ color: gold, fontSize: 28, fontWeight: 700, margin: "0 0 20px", letterSpacing: 0.3 }}>
          {preview.inviter_name}
        </h1>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px", marginBottom: 28, textAlign: "left" }}>
          {[
            "Real compatibility scoring — not just swiping",
            "Date Pledge Bond — both show up or lose credits",
            "GPS check-in at the venue — no ghosting",
            "Integrity Score — your reputation travels with you",
          ].map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <span style={{ color: gold, fontSize: 13, marginTop: 1 }}>+</span>
              <span style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{line}</span>
            </div>
          ))}
        </div>

        {preview.expires_at && (
          <p style={{ color: colors.textMuted, fontSize: 11, margin: "0 0 20px" }}>
            Invite expires {new Date(preview.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        )}

        <button
          onClick={handleAccept}
          disabled={accepting}
          style={{ width: "100%", background: accepting ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #7c3aed, #db2777)", color: accepting ? colors.textMuted : "#fff", border: "none", borderRadius: 12, padding: "15px 24px", fontSize: 16, fontWeight: 700, cursor: accepting ? "not-allowed" : "pointer", fontFamily: "Georgia, serif", letterSpacing: 0.3, transition: "all 0.2s" }}>
          {accepting ? "Accepting..." : "Accept Invite"}
        </button>

        {acceptError && (
          <p style={{ color: "#f87171", fontSize: 13, marginTop: 14 }}>{acceptError}</p>
        )}
      </div>

      <p style={{ color: colors.textMuted, fontSize: 11, marginTop: 32, textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
        BetterMate is a relationships platform built on accountability. Campus-only. Invite required.
      </p>
    </div>
  );
}
