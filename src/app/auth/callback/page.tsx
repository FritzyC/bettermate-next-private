"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";

function sanitizeNext(nextRaw: string | null): string {
  if (!nextRaw) return "/";
  if (nextRaw.startsWith("/")) return nextRaw;
  return "/";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const spGet = (k: string) => (sp ? sp.get(k) : null);

  const nextPath = useMemo(() => sanitizeNext(spGet("next")), [sp]);
  const [status, setStatus] = useState("Completing sign-in…");

  useEffect(() => {
    (async () => {
      const inboundError = spGet("error");
      const inboundMsg = spGet("msg") || spGet("error_description") || "";

      if (inboundError) {
        router.replace(
          `/auth?next=${encodeURIComponent(nextPath)}&error=${encodeURIComponent(
            inboundError
          )}&msg=${encodeURIComponent(inboundMsg)}`
        );
        return;
      }

      const code = spGet("code");
      const supabase = getSupabase();

      if (!supabase) {
        router.replace(
          `/auth?next=${encodeURIComponent(nextPath)}&error=env_missing&msg=${encodeURIComponent(
            "Supabase client unavailable (env missing)."
          )}`
        );
        return;
      }

      if (!code) {
        router.replace(
          `/auth?next=${encodeURIComponent(nextPath)}&error=missing_code&msg=${encodeURIComponent(
            "No OAuth code returned."
          )}`
        );
        return;
      }

      setStatus("Exchanging code for session…");
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        router.replace(
          `/auth?next=${encodeURIComponent(nextPath)}&error=exchange_failed&msg=${encodeURIComponent(
            error.message
          )}`
        );
        return;
      }

      setStatus("Signed in. Redirecting…");
      router.replace(nextPath);
    })();
  }, [router, sp, nextPath]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>BetterMate</h1>
      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: "0 8px" }}>·</span>
        <Link href="/auth">Login</Link>
      </div>

      <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        {status}
      </div>
    </main>
  );
}
