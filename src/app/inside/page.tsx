export default function InsidePage() {
  const serif = "Georgia, serif"
  const sans = "system-ui, sans-serif"
  const gold = "#C9A96E"
  const muted = "rgba(255,255,255,0.35)"
  const dim = "rgba(255,255,255,0.18)"
  const border = "rgba(124,58,237,0.15)"

  const features = [
    {
      title: "Vibe Space",
      body: "Your full connection environment. Every conversation, every tool, every signal — it all moves through here. Not just chat. Context, intention, and direction."
    },
    {
      title: "Shared Sound",
      body: "Music says what words don't. What you share here carries into your connection. It represents you before anything else does."
    },
    {
      title: "Expressions",
      body: "How you communicate matters as much as what you say. Choose how you show presence — there are signals here that most apps don't have language for."
    },
    {
      title: "Coach Insight",
      body: "You're not guessing. Subtle guidance helps you communicate better, ask better questions, and move with intention — not pressure."
    },
    {
      title: "Date Planning",
      body: "When the time comes, BetterMate helps you find a venue, agree on a time, and confirm you're both showing up. The plan is real."
    },
    {
      title: "Date Pledge Bond",
      body: "Commitment is visible here. When both people lock a pledge, the date is real. Credits are returned when it happens. That's the standard."
    },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #06020f 0%, #0e0520 40%, #06020f 100%)", fontFamily: serif, color: "#e8d8f8", padding: "0 0 80px" }}>

      {/* Nav */}
      <div style={{ padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <a href="/matches" style={{ color: dim, fontSize: 13, textDecoration: "none", fontFamily: sans }}>← Your Matches</a>
        <span style={{ fontSize: 11, color: "rgba(139,92,246,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: sans }}>Inside BetterMate</span>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 28px 56px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(36px,6vw,56px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", color: "#f0ecfc", marginBottom: 28 }}>
          You're in.
        </h1>
        <p style={{ fontSize: 17, color: muted, lineHeight: 1.9, margin: "0 auto", maxWidth: 440 }}>
          BetterMate doesn't move all at once.<br />
          It moves when it matters.<br /><br />
          While your next connection is being prepared,<br />
          this is your space.
        </p>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)", margin: "0 40px" }} />

      {/* Vibe Space */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px" }}>
        <p style={{ fontSize: 10, color: "rgba(139,92,246,0.6)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: sans, marginBottom: 20 }}>Your environment</p>
        <h2 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 400, lineHeight: 1.2, color: "#f0ecfc", marginBottom: 20 }}>The Vibe Space</h2>
        <p style={{ fontSize: 16, color: muted, lineHeight: 1.85 }}>
          This is where everything lives.<br /><br />
          Not just conversation —<br />
          context, intention, and direction.<br /><br />
          Every connection you enter<br />
          moves through here.
        </p>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)", margin: "0 40px" }} />

      {/* While you wait */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px 40px" }}>
        <p style={{ fontSize: 10, color: "rgba(139,92,246,0.6)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: sans, marginBottom: 20 }}>What's available now</p>
        <h2 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 400, lineHeight: 1.2, color: "#f0ecfc", marginBottom: 20 }}>While you wait</h2>
        <p style={{ fontSize: 16, color: muted, lineHeight: 1.85, marginBottom: 48 }}>
          Before your next match appears,<br />
          you're not idle.<br /><br />
          You're preparing how you show up.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {features.map((f) => (
            <div key={f.title} style={{ background: "rgba(124,58,237,0.05)", border: "1px solid " + border, borderRadius: 16, padding: "24px 22px" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#c4b5fd", marginBottom: 10, fontFamily: serif }}>{f.title}</p>
              <p style={{ fontSize: 13, color: muted, lineHeight: 1.75, fontFamily: sans }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)", margin: "0 40px" }} />

      {/* How to move */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px" }}>
        <p style={{ fontSize: 10, color: "rgba(139,92,246,0.6)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: sans, marginBottom: 20 }}>The structure</p>
        <h2 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 400, lineHeight: 1.2, color: "#f0ecfc", marginBottom: 20 }}>How to move here</h2>
        <p style={{ fontSize: 16, color: muted, lineHeight: 1.9, marginBottom: 32 }}>
          There's no feed.<br />
          No endless options.<br /><br />
          You move step by step:<br />
          you're introduced — you connect — you decide.<br /><br />
          Each phase opens when it matters.<br /><br />
          You don't need to search.<br />
          You just need to show up.
        </p>
        <p style={{ fontSize: 13, color: dim, fontStyle: "italic", lineHeight: 1.7, fontFamily: sans }}>
          Most people won't use this properly.<br />That's why it works.
        </p>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)", margin: "0 40px" }} />

      {/* What this asks */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 28px" }}>
        <p style={{ fontSize: 10, color: "rgba(139,92,246,0.6)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: sans, marginBottom: 20 }}>The standard</p>
        <h2 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 400, lineHeight: 1.2, color: "#f0ecfc", marginBottom: 24 }}>What this asks of you</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {["Be present.", "Respond with intention.", "Follow through when you commit."].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(139,92,246,0.5)", flexShrink: 0 }} />
              <span style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", fontFamily: serif }}>{item}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 14, color: dim, marginTop: 28, lineHeight: 1.7, fontFamily: sans }}>
          That's what makes everything else work.
        </p>
      </div>

      {/* Close */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 28px 40px", textAlign: "center" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(219,39,119,0.07) 100%)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 20, padding: "52px 32px" }}>
          <h2 style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 400, lineHeight: 1.3, color: "#f0ecfc", marginBottom: 20 }}>
            You'll feel it when it starts.
          </h2>
          <p style={{ fontSize: 15, color: muted, lineHeight: 1.8, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
            When your next connection appears,<br />you'll know what to do.
          </p>
          <a href="/matches" style={{ display: "inline-block", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", borderRadius: 12, padding: "14px 32px", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: serif, letterSpacing: 0.3 }}>
            Return to Matches
          </a>
        </div>
      </div>

    </div>
  )
}
