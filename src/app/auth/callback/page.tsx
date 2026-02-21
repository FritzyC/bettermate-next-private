"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState("Completing sign-in…");

  useEffect(() => {
    (async () => {
      const err = sp?.get("error");
      if (err) {
        const msg =
          sp?.get("error_description") || sp?.get("msg") || sp?.get("error_code") || "";
        router.replace(`/auth?error=${encodeURIComponent(err)}&msg=${encodeURIComponent(msg)}`);
        return;
      }

      const confirmationUrl = sp?.get("confirmation_url");
      if (confirmationUrl) {
        window.location.href = confirmationUrl;
        return;
      }

      const code = sp?.get("code");
      if (!code) {
        router.replace("/auth?error=missing_callback_params");
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        router.replace("/auth?error=supabase_client_null");
        return;
      }

      setStatus("Verifying link…");
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace(`/auth?error=exchange_failed&msg=${encodeURIComponent(error.message)}`);
        return;
      }

      setStatus("Signed in. Redirecting…");
      router.replace("/");
    })();
  }, [router, sp]);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>BetterMate</h1>
      <p>{status}</p>
    </main>
  );
}
