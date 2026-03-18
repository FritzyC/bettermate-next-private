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
  const [authed, setAuthed] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

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
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ token: code }),
    });
    const json = await res.json();
    if (json.ok) {
      const { data: fp } = await supabase.from("user_fingerprint").select("onboarding_complete").eq("id", session.user.id).maybeSingle();
      if (!fp?.onboarding_complete) {
        router.replace("/onboarding?next=/matches/" + json.match_id);
      } else {
        router.replace("/matches/" + json.match_id);
      }
    } else {
      setAcceptError(json.error ?? "Failed to accept invite");
      setAccepting(false);
    }
  }

  useEffect(() => {
    const sb = getSupabase()
    if (sb) sb.auth.getSession().then(({ data: { session } }) => setAuthed(!!session))
  }, [])

  useEffect(() => {
    fetch("/api/invites/preview?token=" + code)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPreview(d);
        else setLoadError(d.error ?? "Invalid invite");
      })
      .catch(() => setLoadError("Could not load invite"));
  }, [code]);

  const gold = "#C9A96E";
  const wrap: React.CSSProperties = { minHeight: "100vh", background: "linear-gradient(160deg, #06020f 0%, #0e0520 40%, #06020f 100%)", fontFamily: "Georgia, serif", color: colors.textPrimary };

  if (loadError) return (
    <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 40, textAlign: "center" }}>
      <p style={{ color: "#f87171", fontSize: 15, marginBottom: 24 }}>{loadError}</p>
      <a href="/" style={{ color: gold, fontSize: 13 }}>Go to BetterMate</a>
    </div>
  );

  if (!preview || accepting) return (
    <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 48, height: 48, background: "linear-gradient(135deg, #7c3aed, #db2777)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", fontWeight: 700 }}>B</div>
      <p style={{ color: colors.textMuted, fontSize: 13 }}>{accepting ? "Accepting your invite..." : "Loading..."}</p>
    </div>
  );

  if (preview.status === "accepted") return (
    <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 40, textAlign: "center" }}>
      <h2 style={{ color: colors.textPrimary, fontSize: 20, margin: "0 0 12px" }}>This invite has already been used.</h2>
      <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 28px" }}>Each invite link is single-use.</p>
      <a href="/" style={{ color: gold, fontSize: 14 }}>Go to BetterMate</a>
    </div>
  );

  return (
    <div style={wrap}>

      {/* HERO */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "72px 28px 56px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, width: "100%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.25)", borderRadius: 20, padding: "6px 14px" }}>
            <span style={{ color: gold, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>Private Invite</span>
          </div>
          {authed ? (
            <button onClick={async () => { const sb = getSupabase(); if (sb) await sb.auth.signOut(); window.location.reload(); }}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#9d84d0", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif" }}>
              Sign out
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href="/how-it-works" style={{ color: "#7A6A96", fontSize: 11, textDecoration: "underline", fontFamily: "Georgia, serif" }}>How it works</a>
            <a href={"/auth?next=/invite/" + code}
              style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif", textDecoration: "none" }}>
              Login / Create Profile
            </a>
          </div>
          )}
        </div>

        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 700, margin: "0 0 20px", lineHeight: 1.2, letterSpacing: "-0.3px", color: colors.textPrimary }}>
          You were invited into something rare.
        </h1>

        <p style={{ fontSize: 16, color: colors.textSecondary, margin: "0 auto 20px", maxWidth: 520, lineHeight: 1.75 }}>
          A place where connection begins with compatibility, intention, and the way someone truly shows up.
        </p>

        <p style={{ fontSize: 15, color: colors.textSecondary, margin: "0 auto 24px", maxWidth: 520, lineHeight: 1.85 }}>
          BetterMate was created for people who want more than attraction in the moment. It is built for those who care about emotional maturity, shared direction, and the possibility of building something meaningful with someone who genuinely fits their life.
        </p>
        <p style={{ fontSize: 18, color: gold, fontStyle: "italic", margin: "0 auto 40px", letterSpacing: 0.3 }}>
          Not just who catches your eye — who fits your life.
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <button onClick={handleAccept} disabled={accepting}
            style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: 14, padding: "17px 48px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: 0.5, boxShadow: "0 8px 32px rgba(124,58,237,0.35)" }}>
            Accept Your Invite
          </button>
          {preview.expires_at && (
            <p style={{ color: colors.textMuted, fontSize: 11, margin: 0 }}>
              Invite expires {new Date(preview.expires_at).toLocaleDateString(undefined, { month: "long", day: "numeric" })} &middot; Single use
            </p>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)", margin: "0 40px" }} />

      {/* WHY YOU WERE INVITED */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px", textAlign: "center" }}>
        <p style={{ color: gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 20px" }}>Why You Were Invited</p>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px", lineHeight: 1.3 }}>This invitation was shared with you personally.</h2>
        <p style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 1.8, margin: 0 }}>
BetterMate is invite-only by design. Every person here enters because someone believed they belonged in a more thoughtful kind of space. That trust shapes the experience from the beginning.

          You were not chosen by an algorithm or pulled into a crowded feed. You were invited into a quieter, more intentional standard — one built on sincerity, discernment, and follow-through.
        </p>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)", margin: "0 40px" }} />

      {/* WHAT MAKES BETTERMATE DIFFERENT */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px", textAlign: "center" }}>
        <p style={{ color: gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 20px" }}>What Makes BetterMate Different</p>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.3 }}>BetterMate is built around alignment, not impression.</h2>
        <p style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 1.8, margin: "0 0 36px" }}>
Most platforms ask you to decide quickly. BetterMate is designed to help you understand more deeply — how someone thinks, how they communicate, what they value, and whether their life truly fits with yours.

          The goal is not more attention. It is more meaning. This is a place for people who want connection to feel clear, mutual, and worth showing up for.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            ["Values", "before vanity"],
            ["Action", "before attention"],
            ["Dignity", "before fantasy"],
          ].map(([top, bottom]) => (
            <div key={top} style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12, padding: "18px 12px" }}>
              <p style={{ color: gold, fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{top}</p>
              <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>{bottom}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)", margin: "0 40px" }} />

      {/* HOW IT WORKS */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px", textAlign: "center" }}>
        <p style={{ color: gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 20px" }}>How It Works</p>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 40px" }}>A more intentional path to real connection.</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            ["01", "Create your real profile.", "Share the things that shape compatibility in real life — your values, your mindset, your pace, your communication style, and the kind of life you hope to build with the right person."],
            ["02", "Meet people with genuine alignment.", "BetterMate is designed to surface connection with substance. The point is not endless browsing. It is discovering someone whose priorities, energy, and direction make sense with your own."],
            ["03", "Move toward something real.", "When there is mutual alignment, BetterMate helps turn that connection into real conversation, real clarity, and real plans. The standard here is not perfection. It is sincerity, effort, and the willingness to follow through."],
          ].map(([num, title, body]) => (
            <div key={num} style={{ display: "flex", gap: 20, textAlign: "left", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 24px" }}>
              <span style={{ color: gold, fontSize: 13, fontWeight: 700, minWidth: 28, opacity: 0.7 }}>{num}</span>
              <div>
                <p style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{title}</p>
                <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0, lineHeight: 1.7 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)", margin: "0 40px" }} />

      {/* OUR STANDARD */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px", textAlign: "center" }}>
        <p style={{ color: gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 20px" }}>Our Standard</p>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px" }}>Connection earns its place here.</h2>
        <p style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 1.85, margin: "0 0 28px" }}>
          We believe the quality of a relationship begins with the quality of intention behind it. Honesty matters. Presence matters. The way you show up matters.
        </p>
        <p style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 1.85, margin: 0 }}>
BetterMate is built to protect that standard for people who take connection seriously. Not to create pressure, but to create trust. Not to create performance, but to create the kind of environment where something meaningful has a real chance to begin.
        </p>
      </div>

      {/* FINAL CTA */}
      <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(219,39,119,0.08) 100%)", border: "1px solid rgba(124,58,237,0.2)", margin: "20px 28px 60px", borderRadius: 20, padding: "52px 28px", textAlign: "center", maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.3 }}>You were invited into<br />a better standard.</h2>
        <p style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.8, margin: "0 auto 12px", maxWidth: 420 }}>
Not louder. Not faster. Better.
        </p>
        <p style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.8, margin: "0 auto 36px", maxWidth: 420 }}>
          A place for people who value substance, emotional maturity, and the possibility of building something real with someone who truly fits their life.
        </p>
        <button onClick={handleAccept} disabled={accepting}
          style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: 14, padding: "17px 48px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: 0.5, marginBottom: 16, boxShadow: "0 8px 32px rgba(124,58,237,0.35)" }}>
          Accept Your Invite
        </button>
        <p style={{ color: colors.textMuted, fontSize: 11, margin: 0 }}>
          Invite-only &middot; Single use &middot; Shared intentionally &middot; Connection earns its place.
        </p>
        {acceptError && <p style={{ color: "#f87171", fontSize: 13, marginTop: 16 }}>{acceptError}</p>}
      </div>

    </div>
  );
}
