'use client';

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function safeTrim(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function getSiteUrl(): string {
  const v = safeTrim(process.env.NEXT_PUBLIC_SITE_URL);
  if (!v) return typeof window !== "undefined" ? window.location.origin : "";
  return v.endsWith("/") ? v.slice(0, -1) : v;
}

function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 12) return k;
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

export default function AuthClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  const siteUrl = useMemo(() => getSiteUrl(), []);
  const next = safeTrim(sp?.get("next")) || "/";

  const inboundError = safeTrim(sp?.get("error"));
  const inboundMsg = safeTrim(sp?.get("msg"));
  const inboundErrorDesc = safeTrim(sp?.get("error_description"));

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const supabase = useMemo(() => {
    return createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }, [supabaseUrl, anonKey]);

  async function sendEmail() {
    setStatus("");
    const e = safeTrim(email);
    if (!e) {
      setStatus("Failed: email_required");
      return;
    }

    setBusy(true);
    try {
      const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setStatus(`Failed: ${error.message}`);
        return;
      }

      setStatus("Email sent. Check your inbox (and spam).");
    } catch (err: any) {
      setStatus(`Failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setStatus("");
    const e = safeTrim(email);
    const c = safeTrim(code);
    if (!e) {
      setStatus("Failed: email_required");
      return;
    }
    if (!c) {
      setStatus("Failed: otp_code_required");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: e,
        token: c,
        type: "email",
      });

      if (error) {
        setStatus(`Failed: ${error.message}`);
        return;
      }

      setStatus("Signed in. Redirecting…");
      router.push(next || "/");
    } catch (err: any) {
      setStatus(`Failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setStatus("");
    setBusy(true);
    try {
      const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setStatus(`Failed: ${error.message}`);
      } else {
        setStatus("Redirecting to Google…");
      }
    } catch (err: any) {
      setStatus(`Failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const envOk = Boolean(supabaseUrl && anonKey);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>BetterMate Login</h1>

      <div style={{ marginBottom: 12 }}>
        <Link href="/">Home</Link>
        <span style={{ margin: "0 8px" }}>·</span>
        <Link href="/debug/bm">Debug</Link>
      </div>

      <section style={{ padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Debug</div>
        <div>AUTH_CLIENT_RENDER=v3</div>
        <div>NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl || "(missing)"}</div>
        <div>hasAnonKey: {anonKey ? "true" : "false"}</div>
        <div>anonKeyPrefix: {anonKey ? anonKey.slice(0, 8) : "(missing)"}</div>
        <div>NEXT_PUBLIC_SITE_URL: {siteUrl || "(missing)"}</div>
        <div>env: {envOk ? "OK" : "MISSING"}</div>

        {(inboundError || inboundMsg || inboundErrorDesc) && (
          <div style={{ marginTop: 10, padding: 10, background: "#fee", border: "1px solid #fbb" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Inbound</div>
            {inboundError && <div>error: {inboundError}</div>}
            {inboundErrorDesc && <div>error_description: {inboundErrorDesc}</div>}
            {inboundMsg && <div>msg: {inboundMsg}</div>}
          </div>
        )}
      </section>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Fast login (recommended)</div>

        <button
          onClick={continueWithGoogle}
          disabled={busy || !envOk}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #333",
            width: "100%",
            fontWeight: 600,
          }}
        >
          Continue with Google
        </button>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Email OTP (may rate-limit)</div>

          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={sendEmail}
              disabled={busy || !envOk}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333" }}
            >
              Send email
            </button>
          </div>

          <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #eee" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              OTP code (use this if links don’t open)
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code from email"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={verifyCode}
                disabled={busy || !envOk}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333" }}
              >
                Verify OTP & Sign in
              </button>
            </div>
          </div>
        </div>

        {status && (
          <p style={{ marginTop: 12, color: status.toLowerCase().includes("failed") ? "#b00020" : "#222" }}>
            {status}
          </p>
        )}
      </section>

      <section style={{ marginTop: 18, fontSize: 13, color: "#444" }}>
        <p>
          If you open an email on your phone, <code>http://localhost:3000</code> won’t work.
          Use Google login above, or ensure <code>NEXT_PUBLIC_SITE_URL</code> is your production domain.
        </p>
      </section>
    </main>
  );
}
