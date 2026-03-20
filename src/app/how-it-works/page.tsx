export default function HowItWorksPage() {
  const gold = "#C9A96E";
  const wrap = { minHeight: "100vh", background: "linear-gradient(160deg, #06020f 0%, #0e0520 40%, #06020f 100%)", fontFamily: "Georgia, serif", color: "#e8d8f8", padding: "0 0 80px" } as const;
  const section = { maxWidth: 640, margin: "0 auto", padding: "56px 28px 0" } as const;
  const h2 = { fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, color: "#fff", margin: "0 0 16px", letterSpacing: 0.3 } as const;
  const body = { fontSize: 15, color: "#b09fd0", lineHeight: 1.85, margin: "0 0 16px" } as const;
  const note = { fontSize: 13, color: gold, fontStyle: "italic" as const, lineHeight: 1.7, margin: "0 0 0" };
  const divider = { height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)", margin: "48px 28px 0", maxWidth: 640, marginLeft: "auto", marginRight: "auto" } as const;

  const steps = [
    {
      num: "01",
      title: "Your Profile",
      body: "Before you meet anyone, BetterMate learns who you actually are. Not your photos first. Your values, communication style, pace, and the things that actually determine whether two people work well together in real life. Your profile is the foundation of everything. The more honestly you complete it, the more precisely BetterMate can surface someone who genuinely fits your life.",
      note: "Answer the onboarding questions as truthfully as you can. There are no right answers — only yours.",
    },
    {
      num: "02",
      title: "Your Match",
      body: "BetterMate surfaces one match at a time. Not a feed. Not a stack of options. One person — selected because their values, goals, and compatibility profile align with yours in ways that matter. You will not see their photo yet. That is intentional.",
      note: "The match was not random. Trust the process.",
    },
    {
      num: "03",
      title: "Blind Chat",
      body: "Before you see each other, you talk to each other. BetterMate opens a blind chat window when you match. Photos stay hidden until two conditions are both satisfied: at least 24 hours have passed since blind chat began, and each person has sent at least 3 messages. Both conditions must be true. The reveal does not happen from time alone. It does not happen from volume alone. It happens when you have both genuinely shown up in conversation.",
      note: "Be present. Ask real questions. Say something that matters. The conversation you have here shapes everything that follows.",
    },
    {
      num: "04",
      title: "The Reveal",
      body: "When both conditions are met, photos unlock. This is a moment — not a reflex. You are about to see the person you have already begun to connect with. Most people find that a reveal that follows real conversation lands differently than one that precedes it. That is the point.",
      note: "The reveal is the beginning of the next phase — not the main event.",
    },
    {
      num: "05",
      title: "72-Hour Date Planning Window",
      body: "After reveal, you have 72 hours to plan a date. Not endless chatting. Not open-ended intention. A defined window — because connection that moves forward is connection that lasts. The 72-hour structure is not pressure. It is protection — for both of you — against the slow drift that turns potential into nothing. Use the Date Plan tool inside your match to agree on a venue and time.",
      note: "Start the conversation early. Decide on a direction. Move forward.",
    },
    {
      num: "06",
      title: "The Date Pledge Bond",
      body: "Before the date is confirmed, both of you lock in a small credit bond. Credits are held — not spent — until the date is completed. When it happens, they are returned in full. If one person cancels without good reason, the bond reflects that. This is not a penalty. It is a signal — a mutual commitment that says: I mean this, and I am prepared to show up.",
      note: "The bond protects your time and theirs. It is one of the things that makes BetterMate different.",
    },
    {
      num: "07",
      title: "The 168-Hour Meet Window",
      body: "Once the date is planned and the bond is locked, a 168-hour meet window opens — for users within 50 miles of each other. Seven days is enough time to meet someone you have genuinely committed to seeing. If you are within range, BetterMate expects movement. This is what separates BetterMate from platforms where matches stay matches indefinitely without going anywhere.",
      note: "Confirm the time. Show up.",
    },
    {
      num: "08",
      title: "Long Distance",
      body: "If you are more than 50 miles apart, the 168-hour meet window does not apply. Instead, you can extend your chat window for $0.99 per day. This keeps the connection alive while you navigate the logistics of distance honestly. Extended chat is a choice — not a default. It exists because some connections are worth the distance. BetterMate supports that path, with clarity about what it requires from both people.",
      note: "Only extend if you are genuinely invested in making it work.",
    },
    {
      num: "09",
      title: "On Hold",
      body: "If the meet window closes without a completed date — and without extended chat — the match goes on hold. Not ended. Not failed. On hold. Life moves. Timing matters. BetterMate holds the connection without pressure until you are ready to return to it. You can reactivate at any time for $4.99. That single decision opens a new window and gives both people a fresh opportunity to move forward.",
      note: "A connection on hold is not a loss. It is a pause.",
    },
    {
      num: "10",
      title: "Your Integrity Score",
      body: "Every completed commitment on BetterMate contributes to your Integrity Score. Showing up builds it. Following through builds it. Consistent, genuine engagement over time builds it. The score is not designed to judge you — it is designed to protect the experience for everyone here, including you. A stronger Integrity Score signals to the platform that you are someone who takes connection seriously. That signal shapes the quality of future introductions you receive.",
      note: "Your score is a reflection of how you show up — not a verdict on who you are.",
    },
    {
      num: "11",
      title: "Invites",
      body: "BetterMate is invite-only. Every person here entered through someone who trusted them enough to extend a personal invitation. That trust shapes the culture from the beginning. After you complete onboarding and reach full activation, you receive 2 invite credits. Use them for people you genuinely believe belong in a more intentional kind of space.",
      note: "An invite from you carries your standard. Use it with intention.",
    },
    {
      num: "12",
      title: "The Standard",
      body: "BetterMate holds a standard — not to restrict, but to protect. What the standard asks of you is simple: be honest about who you are, respect the time and effort of the person across from you, follow through when you commit, and communicate with dignity if something changes. This is not a demanding standard. It is a minimum standard for genuine connection. And it is the reason BetterMate feels different from every other platform you have tried.",
      note: "Connection earns its place here. So does the person offering it.",
    },
  ];

  return (
    <div style={wrap}>

      {/* Hero */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "72px 28px 0", textAlign: "center" }}>
        <img src="/bettermate-logo.png" alt="BetterMate" style={{ width: 200, height: "auto", marginBottom: 16, borderRadius: 12 }} />
        <p style={{ fontSize: 11, color: gold, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 20px" }}>The BetterMate Journey</p>
        <h1 style={{ fontSize: "clamp(28px,5vw,40px)", fontWeight: 700, margin: "0 0 20px", lineHeight: 1.15, color: "#fff" }}>
          Not just who catches your eye —<br />who fits your life.
        </h1>
        <p style={{ fontSize: 15, color: "#b09fd0", lineHeight: 1.85, margin: "0 auto", maxWidth: 480 }}>
          BetterMate is not a swipe app. You were not brought here to browse. You were brought here because someone believed you were ready for a different kind of connection — one built on honesty, values, and the willingness to actually show up.
        </p>
        <p style={{ fontSize: 14, color: gold, fontStyle: "italic", margin: "24px 0 0" }}>Here is how it works.</p>
      </div>

      {steps.map((step, i) => (
        <div key={step.num}>
          <div style={section}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <span style={{ color: gold, fontSize: 12, fontWeight: 700, minWidth: 28, opacity: 0.6, paddingTop: 4, fontFamily: "system-ui, sans-serif" }}>{step.num}</span>
              <div style={{ flex: 1 }}>
                <h2 style={h2}>{step.title}</h2>
                <p style={body}>{step.body}</p>
                <p style={note}>{step.note}</p>
              </div>
            </div>
          </div>
          {i < steps.length - 1 && <div style={divider} />}
        </div>
      ))}

      {/* Footer CTA */}
      <div style={{ maxWidth: 640, margin: "56px auto 0", padding: "0 28px", textAlign: "center" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(219,39,119,0.08) 100%)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 20, padding: "44px 32px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 14px" }}>Ready to begin?</h2>
          <p style={{ fontSize: 14, color: "#b09fd0", lineHeight: 1.8, margin: "0 0 28px", maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
            If you were invited, your entry is waiting. If you want to invite someone, generate a link from your profile.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/auth" style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", borderRadius: 12, padding: "13px 28px", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "Georgia, serif" }}>
              Enter BetterMate
            </a>
            <a href="/invite/create" style={{ background: "rgba(255,255,255,0.05)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 12, padding: "13px 28px", fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: "Georgia, serif" }}>
              Create an Invite
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
