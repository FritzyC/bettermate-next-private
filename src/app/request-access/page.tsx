export default function RequestAccessPage() {
  const gold = "#C9A96E"
  const wrap = { minHeight: "100vh", background: "linear-gradient(160deg, #06020f 0%, #0e0520 40%, #06020f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "Georgia, serif" } as const

  return (
    <div style={wrap}>
      <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(219,39,119,0.07) 100%)", border: "1px solid rgba(124,58,237,0.28)", borderRadius: 20, padding: "48px 36px", maxWidth: 480, width: "100%", textAlign: "center" }}>
        <img src="/bettermate-logo.png" alt="BetterMate" style={{ width: 140, height: "auto", borderRadius: 12, marginBottom: 28 }} />
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.2 }}>
          BetterMate is invite-only.
        </h1>
        <p style={{ color: "#b09fd0", fontSize: 15, lineHeight: 1.8, margin: "0 0 12px" }}>
          Every person here entered through a personal invitation from someone who believed they belonged in a more intentional space.
        </p>
        <p style={{ color: "#b09fd0", fontSize: 15, lineHeight: 1.8, margin: "0 0 32px" }}>
          If you received an invite link, open it directly to get started. If you do not have one yet, you can request access below by telling us why you'd like to join BetterMate.
        </p>
        <a href="mailto:fritz@charpconsulting.com?subject=BetterMate Invite Request&body=Hi — I would like to request an invite to BetterMate."
          style={{ display: "inline-block", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, textDecoration: "none", fontFamily: "Georgia, serif", marginBottom: 20 }}>
          Request an Invite
        </a>

        <p style={{ color: "#3a2a55", fontSize: 11, marginTop: 28, lineHeight: 1.6 }}>
          Where connection earns its place.
        </p>
      </div>
    </div>
  )
}
