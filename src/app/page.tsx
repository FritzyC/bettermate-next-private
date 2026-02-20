// src/app/page.tsx
"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function maskKey(key: string) {
  const k = (key || "").trim();
  if (k.length <= 16) return k ? "••••••••" : "";
  return `${k.slice(0, 10)}…${k.slice(-6)}`;
}

export default function Home() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  const envOk = !!supabaseUrl && !!supabaseAnonKey;

  const supabase = useMemo(() => {
    if (!envOk) return null;
    try {
      return createClient(supabaseUrl, supabaseAnonKey);
    } catch {
      return null;
    }
  }, [envOk, supabaseUrl, supabaseAnonKey]);

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState<string>("");

  async function testConnection() {
    if (!supabase) {
      setTestStatus("fail");
      setTestMsg("Missing env vars. Add them to .env.local and restart `npm run dev`.");
      return;
    }

    setTestStatus("testing");
    setTestMsg("");

    try {
      // Auth endpoint test (does not depend on your DB tables)
      const { error } = await supabase.auth.getSession();
      if (error) throw error;

      setTestStatus("ok");
      setTestMsg("Supabase reachable ✅ (auth endpoint responded).");
    } catch (e: any) {
      setTestStatus("fail");
      setTestMsg(e?.message ? String(e.message) : "Supabase connection failed.");
    }
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
        </div>

        {/* Env Status Card */}
        <div className="mt-10 rounded-2xl bg-white p-6 border border-purple-200/60 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-purple-900">Step 1: Supabase environment check</h2>
              <p className="text-sm text-purple-700 mt-1">
                This page will never blank out—if env keys are missing, you’ll see it here.
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
              {testStatus === "testing" ? "Testing…" : "Test Supabase Connection"}
            </button>

            <div className="text-sm">
              {testStatus === "ok" ? (
                <span className="text-emerald-700">{testMsg}</span>
              ) : testStatus === "fail" ? (
                <span className="text-red-600">{testMsg}</span>
              ) : (
                <span className="text-purple-700/80">
                  If this fails, we’ll fix it before building anything else.
                </span>
              )}
            </div>
          </div>

          {!envOk ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-semibold">Fix now:</div>
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>Open <span className="font-mono">.env.local</span> in the project root.</li>
                <li>Paste your Supabase URL + anon key (no quotes).</li>
                <li>Stop the dev server (CTRL+C) and run <span className="font-mono">npm run dev</span> again.</li>
              </ol>
            </div>
          ) : null}
        </div>

        {/* Next Steps */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white p-6 border border-purple-200/60 shadow-sm">
            <h3 className="font-semibold text-purple-900">Next build milestone</h3>
            <p className="mt-2 text-sm text-purple-700">
              Create the app skeleton: auth, invite flow, matches, chat, and behavior logging (RAG memory).
            </p>
            <ul className="mt-4 text-sm text-purple-800 space-y-2 list-disc ml-5">
              <li>Auth: phone/email login (Supabase Auth)</li>
              <li>Invite: single “accept after auth” pathway (email + SMS)</li>
              <li>RAG: behavior events + user memory upserts everywhere</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-6 border border-purple-200/60 shadow-sm">
            <h3 className="font-semibold text-purple-900">Safety rule (prevents blank pages)</h3>
            <p className="mt-2 text-sm text-purple-700">
              No TypeScript types in <span className="font-mono">.jsx</span> files and no broken exports. We’ll keep
              utilities in <span className="font-mono">.ts</span> only and import them from one canonical path.
            </p>
            <div className="mt-4 text-sm text-purple-800">
              When something breaks, we fix <span className="font-semibold">one file at a time</span> and re-run the app
              immediately.
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-sm text-purple-700/80">
          Leave <span className="font-mono">npm run dev</span> running and keep this page open.
          After you click “Test Supabase Connection”, paste the result here.
        </div>
      </div>
    </div>
  );
}
