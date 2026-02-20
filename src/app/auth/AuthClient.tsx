"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";

function safeTrim(v: string | undefined | null): string {
  return (v ?? "").trim();
}

function safeOrigin(url: string): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

export default function AuthClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const supabaseUrl = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const siteUrlEnv = safeTrim(process.env.NEXT_PUBLIC_SITE_URL);
  const siteUrl =
    siteUrlEnv || (typeof window !== "undefined" ? window.location.origin : "");
  const origin = safeOrigin(supabaseUrl);

  const supabase: SupabaseClient | null = useMemo(() => getSupabase(), []);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const inboundError = safeTrim(sp.get("error"));
  const inboundMsg = safeTrim(sp.get("msg"));
  const inboundErrorDesc = safeTrim(sp.get("error_description"));

  async function sendEmail() {
    setStatus("");
    if (!supabase) {
      setStatus("Supabase client is not ready in the browser.");
      return;
    }
    if (!email.trim()) {
      setStatus("Enter an email address.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
          shouldCreateUser: true,
        },
      });

      if (error) {
        setStatus(`Send failed: ${error.message}`);
        return;
      }

      setStatus(
        `Email sent. If you open the link on a device that cannot reach ${siteUrl}, use the code field below instead. Redirect: ${siteUrl}/auth/callback`
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setStatus("");
    if (!supabase) {
      setStatus("Supabase client is not ready in the browser.");
      return;
    }
    if (!email.trim()) {
      setStatus("Enter the same email you requested the code for.");
      return;
    }
    if (!code.trim()) {
      setStatus("Enter the code from the email.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });

      if (error) {
        setStatus(`Verify failed: ${error.message}`);
        return;
      }

      setStatus("Signed in. Redirecting…");
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>BetterMate Login</h1>

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Debug</h2>
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
          <div>AUTH_CLIENT_RENDER=v2</div>
          <div>NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl || "(missing)"}</div>
          <div>origin: {origin || "(invalid url)"}</div>
          <div>hasAnonKey: {anonKey ? "true" : "false"}</div>
          <div>anonKeyPrefix: {anonKey ? anonKey.slice(0, 8) : "(missing)"}</div>
          <div>NEXT_PUBLIC_SITE_URL: {siteUrl || "(missing)"} </div>
          <div>Supabase client: {supabase ? "READY" : "NULL"}</div>
        </div>

        {(inboundError || inboundMsg || inboundErrorDesc) && (
          <div style={{ marginTop: 12, padding: 10, background: "#fff3cd", borderRadius: 8 }}>
            <strong>Auth error:</strong>{" "}
            {inboundError || "unknown"}{" "}
            {inboundMsg ? `— ${inboundMsg}` : ""}{" "}
            {inboundErrorDesc ? `— ${inboundErrorDesc}` : ""}
          </div>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
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
            disabled={busy}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333" }}
          >
            Send email
          </button>
        </div>

        <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            OTP code (use this if localhost links don’t open)
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
              disabled={busy}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333" }}
            >
              Verify OTP & Sign in
            </button>
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
          If you open the email on your phone, <code>http://localhost:3000</code> won’t work.
          Either (1) use the OTP code entry above, or (2) set NEXT_PUBLIC_SITE_URL to your LAN IP
          (example: <code>http://192.168.1.161:3000</code>) and restart dev.
        </p>
      </section>
    </main>
  );
}
