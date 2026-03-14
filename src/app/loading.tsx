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
          0%   { opacity: 0; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        .bm-loader {
          animation: bmFadeIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
      `}</style>

      <div className="bm-loader">

        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bmGrad" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>

          <rect width="72" height="72" rx="18" fill="url(#bmGrad)" />

          <g transform="translate(10, 13)">
            <path
              d="M26 10 C26 10 20 4 13 8 C6 12 8 20 14 24 L26 34 L38 24 C44 20 46 12 39 8 C32 4 26 10 26 10Z"
              fill="white"
              fillOpacity="0.95"
            />
            <path
              d="M8 30 L16 38"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M14 36 L22 28 L30 34 L38 26"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="38" cy="26" r="3" fill="white" />
          </g>
        </svg>

        <p style={{
          fontFamily: 'Georgia, serif',
          fontSize: 13,
          color: 'rgba(201, 169, 110, 0.7)',
          letterSpacing: 3,
          textTransform: 'uppercase',
          margin: 0,
        }}>
          BetterMate
        </p>

      </div>
    </div>
  )
}
