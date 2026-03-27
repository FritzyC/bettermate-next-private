export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #05030d; color: #e8e4f0; font-family: 'DM Sans', sans-serif; }
        .serif { font-family: 'Playfair Display', Georgia, serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        .fade-up { animation: fadeUp 1.1s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1 { animation-delay: 0.1s; opacity: 0; }
        .d2 { animation-delay: 0.3s; opacity: 0; }
        .d3 { animation-delay: 0.5s; opacity: 0; }
        .d4 { animation-delay: 0.7s; opacity: 0; }
        .d5 { animation-delay: 0.9s; opacity: 0; }
        .step { border-left: 1px solid rgba(139,92,246,0.2); padding-left: 24px; padding-bottom: 32px; position: relative; }
        .step::before { content: ''; position: absolute; left: -4px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: rgba(139,92,246,0.6); }
        .step:last-child { padding-bottom: 0; }
        .divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.3), transparent); margin: 0 auto; }
        .cta-btn { display: inline-block; padding: 15px 36px; border-radius: 3px; font-size: 14px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; font-family: 'DM Sans', sans-serif; }
        .cta-primary { background: rgba(139,92,246,0.15); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.4); }
        .cta-primary:hover { background: rgba(139,92,246,0.25); border-color: rgba(139,92,246,0.7); }
        .cta-secondary { background: transparent; color: #9ca3af; border: 1px solid rgba(255,255,255,0.1); }
        .cta-secondary:hover { border-color: rgba(255,255,255,0.25); color: #e8e4f0; }
        .form-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; padding: 14px 18px; color: #e8e4f0; font-size: 15px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.2s; resize: none; }
        .form-input:focus { border-color: rgba(139,92,246,0.5); }
        .form-input::placeholder { color: rgba(255,255,255,0.2); }
        .form-label { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 8px; display: block; }
        .glow-orb { position: absolute; border-radius: 50%; filter: blur(80px); animation: glow 6s ease-in-out infinite; pointer-events: none; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', background: 'rgba(5,3,13,0.8)' }}>
        <span className="serif" style={{ fontSize: 18, fontWeight: 500, color: '#e8e4f0', letterSpacing: '-0.02em' }}>BetterMate</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <a href="#request" className="cta-btn cta-secondary" style={{ padding: '10px 20px', fontSize: 12 }}>Request Access</a>
          <a href="/invite/enter" className="cta-btn cta-primary" style={{ padding: '10px 20px', fontSize: 12 }}>Enter with Invite</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb" style={{ width: 600, height: 600, top: '10%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(91,33,182,0.25) 0%, transparent 70%)' }} />
        <div className="glow-orb" style={{ width: 300, height: 300, bottom: '20%', right: '10%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', animationDelay: '3s' }} />
        <div style={{ maxWidth: 700, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="fade-up d1">
            <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.8)', marginBottom: 32 }}>Private · Invite-only · Reviewed</p>
          </div>
          <div className="fade-up d2">
            <h1 className="serif" style={{ fontSize: 'clamp(44px, 7vw, 80px)', fontWeight: 400, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#f0ecfc', marginBottom: 20 }}>
              Connection,<br />without compromise.
            </h1>
          </div>
          <div className="fade-up d3">
            <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.45)', fontWeight: 300, lineHeight: 1.6, marginBottom: 48, letterSpacing: '-0.01em' }}>
              One person. Real intention. Nothing wasted.
            </p>
          </div>
          <div className="fade-up d4" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#request" className="cta-btn cta-primary">Request Access</a>
            <a href="/auth" className="cta-btn cta-secondary">Enter with Invite</a>
          </div>
          <div className="fade-up d5">
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 24, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Private · Invite-only · Reviewed</p>
          </div>
        </div>
      </section>

      <div className="divider" style={{ maxWidth: 600 }} />

      {/* BELIEF SHIFT */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 24px', maxWidth: 680, margin: '0 auto' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.6)', marginBottom: 28 }}>The difference</p>
        <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#f0ecfc', marginBottom: 32 }}>
          Most platforms optimize for attention.<br />We optimize for follow-through.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.85, fontWeight: 300 }}>
          Endless options don't create better outcomes. They create hesitation.<br /><br />
          BetterMate removes the noise so connection has somewhere to go.
        </p>
      </section>

      <div className="divider" style={{ maxWidth: 600 }} />

      {/* IDENTITY FILTER */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 24px', maxWidth: 680, margin: '0 auto' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.6)', marginBottom: 28 }}>Who this is for</p>
        <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#f0ecfc', marginBottom: 32 }}>
          This isn't open.<br />And it's not for everyone.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.85, fontWeight: 300, marginBottom: 32 }}>
          BetterMate is built for people who:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
          {['Follow through.', 'Communicate clearly.', 'Value real connection over constant options.'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(139,92,246,0.6)', flexShrink: 0 }} />
              <span style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>{item}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', lineHeight: 1.7 }}>
          If that's not how you move, this won't feel right.
        </p>
      </section>

      <div className="divider" style={{ maxWidth: 600 }} />

      {/* HOW IT WORKS */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 24px', maxWidth: 680, margin: '0 auto' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.6)', marginBottom: 28 }}>How it works</p>
        <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#f0ecfc', marginBottom: 60 }}>
          Twelve steps.<br />No shortcuts.
        </h2>
        <div>
          {[
            ['01', 'Your Profile', 'BetterMate starts with who you are. Not how you look.'],
            ['02', 'Your Match', 'One match. Chosen with intention.'],
            ['03', 'Blind Chat', 'You speak before you see.'],
            ['04', 'The Reveal', 'Then, you see them.'],
            ['05', '72-Hour Window', 'You plan. Or it fades.'],
            ['06', 'The Bond', 'Commitment is visible.'],
            ['07', 'Meet Window', 'If you\'re close, you meet.'],
            ['08', 'Distance', 'If not, you choose.'],
            ['09', 'On Hold', 'Timing pauses. Not ends.'],
            ['10', 'Integrity Score', 'You are how you show up.'],
            ['11', 'Invites', 'Access is passed, not given.'],
            ['12', 'The Standard', 'Respect. Clarity. Follow-through.'],
          ].map(([num, title, body]) => (
            <div key={num} className="step">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', minWidth: 24 }}>{num}</span>
                <span className="serif" style={{ fontSize: 17, color: '#e8e4f0', fontWeight: 400 }}>{title}</span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, paddingLeft: 40 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" style={{ maxWidth: 600 }} />

      {/* EMOTIONAL CLOSE */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 24px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <h2 className="serif" style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.03em', color: '#f0ecfc', marginBottom: 32 }}>
          You can feel the difference.
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.4)', lineHeight: 1.85, fontWeight: 300, maxWidth: 480, margin: '0 auto' }}>
          When someone is present. When intention is clear. When effort is mutual.<br /><br />
          Most people aren't used to that.
        </p>
      </section>

      <div className="divider" style={{ maxWidth: 600 }} />

      {/* REQUEST ACCESS FORM */}
      <section id="request" style={{ padding: 'clamp(80px,10vw,140px) 24px', maxWidth: 620, margin: '0 auto' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.6)', marginBottom: 28 }}>Request access</p>
        <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#f0ecfc', marginBottom: 16 }}>
          You don't browse here.<br />You decide.
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginBottom: 56, lineHeight: 1.7 }}>Access is limited and reviewed.</p>

        <form action={`mailto:fritz@charpconsulting.com`} method="get" encType="text/plain" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="form-label">Name</label>
              <input name="name" className="form-input" placeholder="Your name" />
            </div>
            <div>
              <label className="form-label">Age</label>
              <input name="age" className="form-input" placeholder="Your age" type="number" min="21" />
            </div>
          </div>
          <div>
            <label className="form-label">City</label>
            <input name="city" className="form-input" placeholder="Where are you based?" />
          </div>
          <div>
            <label className="form-label">Why BetterMate?</label>
            <textarea name="why" className="form-input" rows={4} placeholder="What draws you here?" />
          </div>
          <div>
            <label className="form-label">What are you looking for that doesn't exist elsewhere?</label>
            <textarea name="seeking" className="form-input" rows={4} placeholder="Be honest. That's the point." />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <button type="submit" className="cta-btn cta-primary">Submit Request</button>
            <a href="/auth" className="cta-btn cta-secondary">Enter with Invite</a>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8 }}>Private · Invite-only · Reviewed</p>
        </form>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <span className="serif" style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>BetterMate</span>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.05em' }}>Where connection earns its place.</p>
      </footer>
    </>
  )
}
