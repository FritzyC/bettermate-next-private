"use client"
import { useState } from "react"

export default function RequestAccessPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: "", age: "", city: "", why: "", seeking: "" })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await fetch("https://formspree.io/f/xpwzgkqy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, _subject: "BetterMate Access Request — " + form.name }),
      })
    } catch {}
    setSubmitted(true)
  }

  const gold = "#C9A96E"

  return (
    <div style={{ minHeight: "100vh", background: "#05030d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", position: "relative", overflow: "hidden", fontFamily: "Georgia, serif" }}>

      <div style={{ position: "absolute", width: 500, height: 500, top: "0%", left: "50%", transform: "translateX(-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(91,33,182,0.2) 0%, transparent 70%)", filter: "blur(100px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>

        <p style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(139,92,246,0.6)", marginBottom: 24, fontFamily: "system-ui, sans-serif" }}>Request access</p>

        <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#f0ecfc", marginBottom: 20 }}>
          You don't browse here.<br />You decide.
        </h1>

        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", fontStyle: "italic", marginBottom: 16 }}>
          Connection earns its place here.
        </p>

        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", letterSpacing: "0.04em", lineHeight: 1.6, fontFamily: "system-ui, sans-serif", marginBottom: 48 }}>
          Access is limited. Every request is reviewed.
        </p>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)", marginBottom: 48 }} />

        {submitted ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <h2 style={{ fontSize: 28, fontWeight: 400, color: "#f0ecfc", lineHeight: 1.4, marginBottom: 16 }}>Request received.</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", lineHeight: 1.8, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>
              We review intentionally.<br />If it aligns, you will hear from us.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", fontStyle: "italic", marginBottom: 12, fontFamily: "system-ui, sans-serif" }}>
              If this resonates, you will know what to say.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[["name", "Name", "Your name", "text"], ["age", "Age", "Your age", "number"]].map(([field, label, ph, type]) => (
                <div key={field} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "system-ui, sans-serif" }}>{label}</label>
                  <input type={type} min={type === "number" ? 21 : undefined} value={(form as any)[field]} onChange={e => set(field, e.target.value)} placeholder={ph} required
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "14px 18px", color: "#e8e4f0", fontSize: 15, fontFamily: "system-ui, sans-serif", fontWeight: 300, outline: "none", width: "100%" }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "system-ui, sans-serif" }}>City</label>
              <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Where you are based" required
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "14px 18px", color: "#e8e4f0", fontSize: 15, fontFamily: "system-ui, sans-serif", fontWeight: 300, outline: "none" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "system-ui, sans-serif" }}>Why BetterMate?</label>
              <textarea rows={4} value={form.why} onChange={e => set("why", e.target.value)} placeholder="What draws you here?" required
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "14px 18px", color: "#e8e4f0", fontSize: 15, fontFamily: "system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "none", lineHeight: 1.7 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "system-ui, sans-serif" }}>What are you looking for that does not exist elsewhere?</label>
              <textarea rows={4} value={form.seeking} onChange={e => set("seeking", e.target.value)} placeholder="Be honest. That is the point." required
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "14px 18px", color: "#e8e4f0", fontSize: 15, fontFamily: "system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "none", lineHeight: 1.7 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "system-ui, sans-serif" }}>Be honest. That is the point.</span>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 8 }}>
              <button type="submit" style={{ padding: "15px 40px", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.35)", borderRadius: 3, color: "#c4b5fd", fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
                Submit Request
              </button>
              <a href="/auth" style={{ padding: "15px 40px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "system-ui, sans-serif", textDecoration: "none" }}>
                Enter with Invite
              </a>
            </div>

            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "system-ui, sans-serif" }}>
              Private · Invite-only · Reviewed
            </p>
          </form>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 32, left: 0, right: 0, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.12)" }}>
          BetterMate &mdash; Where connection earns its place.
        </p>
      </div>
    </div>
  )
}
