export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a041a 0%, #10062a 50%, #0a041a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <style>{`
        @keyframes bmFadeIn {
          0%   { opacity: 0; transform: scale(0.94); }
          100% { opacity: 1; transform: scale(1); }
        }
        .bm-loader {
          animation: bmFadeIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
      `}</style>
      <div className="bm-loader">
        <img
          src="/bettermate-logo.png"
          alt="BetterMate"
          style={{
            width: 220,
            height: 'auto',
            mixBlendMode: 'screen',
            filter: 'drop-shadow(0 0 40px rgba(124, 58, 237, 0.5))',
          }}
        />
      </div>
    </div>
  )
}
