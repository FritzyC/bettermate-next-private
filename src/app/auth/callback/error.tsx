"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1>BetterMate Sign-in</h1>
      <p style={{ color: "crimson", fontWeight: 600 }}>Callback page crashed</p>
      <p style={{ color: "crimson" }}>{error?.message}</p>
      <button onClick={reset} style={{ padding: "10px 14px", borderRadius: 8 }}>
        Retry
      </button>
    </main>
  );
}
