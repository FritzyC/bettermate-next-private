"use client"
import { useState } from "react"

export default function RequestAccessPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: "", age: "", city: "", why: "", seeking: "" })
  const [focused, setFocused] = useState("")

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  const focusStyle = { borderColor: "rgba(139,92,246,0.45)", boxShadow: "0 0 0 3px rgba(139,92,246,0.07), 0 0 18px rgba(139,92,246,0.08)" }

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

  const inp = (extra?: Record<string, unknown>) => ({ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "14px 18px", color: "#eae8f0", fontSize: 15, fontFamily: "system-ui, sans-serif", fontWeight: 300, outline: "none", transition: "border-color 0.25s, box-shadow 0.25s", ...(extra || {}) })

  return (
    <div style={{ minHeight: "100vh", background: "#07050f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", position: "relative", overflow: "hidden", fontFamily: "Georgia, serif" }}>

      <div style={{ position: "absolute", width: 600, height: 600, top: "-10%", left: "50%", transform: "translateX(-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,42,180,0.18) 0%, transparent 70%)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 300, height: 300, bottom: "5%", right: "5%", borderRadius: "50%", background: "radial-gradient(circle, rgba(109,40,217,0.1) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>

        <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(167,139,250,0.7)", marginBottom: 28, fontFamily: "system-ui, sans-serif" }}>Request access</p>

        <h1 style={{ fontSize: "clamp(34px,5.5vw,54px)", fontWeight: 400, lineHeight: 1.12, letterSpacing: "-0.025em", color: "#f0ecfc", marginBottom: 22 }}>
          You don&apos;t browse here.<br />You decide.
        </h1>

        <p style={{ fontSize: 19, color: "rgba(255,255,255,0.38)", fontStyle: "italic", marginBottom: 18, lineHeight: 1.5 }}>
          Connection earns its place here.
        </p>

        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em", lineHeight: 1.7, fontFamily: "system-ui, sans-serif", marginBottom: 48 }}>
          Access is limited. Every request is reviewed.
        </p>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.25), transparent)", marginBottom: 48 }} />

        {submitted ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <h2 style={{ fontSize: 28, fontWeight: 400, color: "#f0ecfc", lineHeight: 1.4, marginBottom: 18 }}>Request received.</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", lineHeight: 1.85, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>
              We review intentionally.<br />If it aligns, you will hear from us.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontStyle: "italic", marginBottom: 12, fontFamily: "system-ui, sans-serif" }}>
              If this resonates, you will know what to say.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 8, display: "block", fontFamily: "system-ui, sans-serif" }}>Name</label>
                <input placeholder="Your name" value={form.name} onChange={e => set("name", e.target.value)} onFocus={() => setFocused("name")} onBlur={() => setFocused("")} required style={inp(focused === "name" ? focusStyle : {})} />
              </div>
              <div>
                <label style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 8, display: "block", fontFamily: "system-ui, sans-serif" }}>Age</label>
                <input type="number" min="21" placeholder="Your age" value={form.age} onChange={e => set("age", e.target.value)} onFocus={() => setFocused("age")} onBlur={() => setFocused("")} required style={inp(focused === "age" ? focusStyle : {})} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 8, display: "block", fontFamily: "system-ui, sans-serif" }}>City</label>
              <input placeholder="Where you are based" value={form.city} onChange={e => set("city", e.target.value)} onFocus={() => setFocused("city")} onBlur={() => setFocused("")} required style={inp(focused === "city" ? focusStyle : {})} />
            </div>

            <div>
              <label style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 8, display: "block", fontFamily: "system-ui, sans-serif" }}>Why BetterMate?</label>
              <textarea rows={4} placeholder="What draws you here?" value={form.why} onChange={e => set("why", e.target.value)} onFocus={() => setFocused("why")} onBlur={() => setFocused("")} required style={{ ...inp(focused === "why" ? focusStyle : {}), resize: "none", lineHeight: 1.75 }} />
            </div>

            <div>
              <label style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginBottom: 8, display: "block", fontFamily: "system-ui, sans-serif" }}>What are you looking for that does not exist elsewhere?</label>
              <textarea rows={4} placeholder="Be honest. That is the point." value={form.seeking} onChange={e => set("seeking", e.target.value)} onFocus={() => setFocused("seeking")} onBlur={() => setFocused("")} required style={{ ...inp(focused === "seeking" ? focusStyle : {}), resize: "none", lineHeight: 1.75 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: "system-ui, sans-serif", marginTop: 6, letterSpacing: "0.03em", display: "block" }}>Be honest. That is the point.</span>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 8 }}>
              <button type="submit" style={{ padding: "14px 38px", background: "rgba(139,92,246,0.13)", border: "1px solid rgba(139,92,246,0.38)", borderRadius: 3, color: "#c4b5fd", fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>Submit Request</button>
              <a href="/auth" style={{ padding: "14px 38px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "system-ui, sans-serif", textDecoration: "none", display: "inline-block" }}>Enter with Invite</a>
            </div>
          </form>
        )}

        <div style={{ marginTop: 56, textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "rgba(240,236,252,0.88)", letterSpacing: "0.04em", marginBottom: 10, textShadow: "0 0 12px rgba(167,139,250,0.25)", fontFamily: "Georgia, serif" }}>BetterMate &mdash; Where connection earns its place.</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "system-ui, sans-serif", textShadow: "0 0 8px rgba(167,139,250,0.15)" }}>Private &middot; Invite-only &middot; Reviewed</p>
        </div>
      </div>
    </div>
  )
}
