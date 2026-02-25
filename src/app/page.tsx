// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function maskKey(key: string) {
  const k = (key || "").trim();
  if (k.length <= 16) return k ? "••••••••" : "";
  return `${k.slice(0, 10)}…${k.slice(-6)}`;
}

function getAccessTokenFromLocalStorage(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.includes("auth-token")) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch { continue; }
      const sess =
        parsed?.session ||
        parsed?.currentSession ||
        parsed?.data?.session ||
        (parsed?.access_token ? parsed : null);
      if (typeof sess?.access_token === "string") return sess.access_token as string;
    }
  } catch { /* ignore */ }
  return null;
}

export default function Home() {
  const router = useRouter();
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  const envOk = !!supabaseUrl && !!supabaseAnonKey;

  const supabase = useMemo(() => {
    if (!envOk) return null;
    try { return createClient(supabaseUrl, supabaseAnonKey); } catch { return null; }
  }, [envOk, supabaseUrl, supabaseAnonKey]);

  // true while we check for an existing session
  const [checking, setChecking] = useState(envOk);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState<string>("");

  // On mount: if env is present, check for an existing session and redirect
  useEffect(() => {
    if (!envOk || !supabase) { setChecking(false); return; }
    (async () => {
      try {
        const token = getAccessTokenFromLocalStorage();
        if (token) {
          const { data: u } = await supabase.auth.getUser(token);
          if (u?.user?.id) { router.replace("/matches"); return; }
        }
      } catch { /* ignore – fall through to landing */ }
      setChecking(false);
    })();
  }, [envOk, supabase, router]);

  async function testConnection() {
    if (!supabase) {
      setTestStatus("fail");
      setTestMsg("Missing env vars. Add them to .env.local and restart `npm run dev`.");
      return;
    }
    setTestStatus("testing"); setTestMsg("");
    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      setTestStatus("ok");
      setTestMsg("Supabase reachable ✅ (auth endpoint responded).");
    } catch (e: unknown) {
      setTestStatus("fail");
      setTestMsg(e instanceof Error ? e.message : "Supabase connection failed.");
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-purple-700 text-lg">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50">
      <div className="mx-auto max-w-4xl px-6 py-14">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg">
            <span className="text-white text-3xl font-bold">B</span>
          </div>
          <h1 className="mt-6 font-serif text-4xl lg:text-5xl bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent">
            BetterMate
          </h1>
          <p className="mt-3 text-lg text-purple-800/90 max-w-2xl mx-auto">
            Values-first compatibility + real-world logistics + progressive identity indexing.
          </p>
          {envOk && (
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
              <Link
                href="/auth"
                className="h-11 px-6 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium shadow hover:opacity-95 inline-flex items-center"
              >
                Sign in
              </Link>
              <Link
                href="/matches"
                className="h-11 px-6 rounded-full bg-white border border-purple-200 text-purple-800 font-medium shadow-sm hover:bg-purple-50 inline-flex items-center"
              >
                My Matches
              </Link>
            </div>
          )}
        </div>

        {/* Env Status Card */}
        <div className="mt-10 rounded-2xl bg-white p-6 border border-purple-200/60 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-purple-900">Supabase environment</h2>
              <p className="text-sm text-purple-700 mt-1">
                Required to use the app. Set these in{" "}
                <span className="font-mono">.env.local</span>.
              </p>
            </div>
            <div
              className={`px-3 py-1.5 rounded-full text-sm border ${
                envOk
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {envOk ? "ENV: OK" : "ENV: MISSING"}
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-purple-200/60 bg-purple-50/50 p-4">
              <div className="text-xs text-purple-700">NEXT_PUBLIC_SUPABASE_URL</div>
              <div className="mt-1 text-sm font-mono text-purple-900 break-all">
                {supabaseUrl || "— missing —"}
              </div>
            </div>
            <div className="rounded-xl border border-purple-200/60 bg-purple-50/50 p-4">
              <div className="text-xs text-purple-700">NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
              <div className="mt-1 text-sm font-mono text-purple-900 break-all">
                {supabaseAnonKey ? maskKey(supabaseAnonKey) : "— missing —"}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              onClick={testConnection}
              disabled={testStatus === "testing"}
              className="h-11 px-5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium shadow hover:opacity-95 disabled:opacity-60"
            >
              {testStatus === "testing" ? "Testing…" : "Test Connection"}
            </button>
            <div className="text-sm">
              {testStatus === "ok" && <span className="text-emerald-700">{testMsg}</span>}
              {testStatus === "fail" && <span className="text-red-600">{testMsg}</span>}
            </div>
          </div>

          {!envOk && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-semibold">Fix now:</div>
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>
                  Open <span className="font-mono">.env.local</span> in the project root.
                </li>
                <li>Paste your Supabase URL + anon key (no quotes).</li>
                <li>
                  Stop the dev server and run{" "}
                  <span className="font-mono">npm run dev</span> again.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Quick links (only when env is present) */}
        {envOk && (
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[
              { href: "/auth", label: "Sign in / Sign up", desc: "Email OTP or Google OAuth" },
              { href: "/matches", label: "Matches", desc: "View your matches and start chatting" },
              { href: "/debug/bm", label: "BM Debug", desc: "Inspect behavior event queue" },
            ].map(({ href, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl bg-white p-5 border border-purple-200/60 shadow-sm hover:border-purple-400 transition-colors"
              >
                <div className="font-semibold text-purple-900">{label}</div>
                <div className="mt-1 text-sm text-purple-700">{desc}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
