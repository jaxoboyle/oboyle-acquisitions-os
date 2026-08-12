"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const redirect = params.get("redirect") ?? "/dashboard";
  const callbackError = params.get("error");

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push(redirect);
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}` },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setMagicSent(true);
    setLoading(false);
  }

  return (
    <div className="card p-6">
      {magicSent ? (
        <div className="text-center py-4">
          <p className="text-text font-medium">Check your email</p>
          <p className="text-sm text-text-muted mt-2">
            We sent a login link to <strong>{email}</strong>.
          </p>
          <button
            onClick={() => { setMagicSent(false); setMode("password"); }}
            className="mt-4 text-sm text-brand hover:underline"
          >
            Try a different method
          </button>
        </div>
      ) : (
        <>
          {callbackError && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2 mb-4">
              {callbackError}
            </p>
          )}
          <div className="flex rounded bg-bg-muted p-1 mb-5">
            {(["password", "magic"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  mode === m
                    ? "bg-surface text-text shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {m === "password" ? "Password" : "Magic Link"}
              </button>
            ))}
          </div>

          <form
            onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-text-muted mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {mode === "password" && (
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-text-muted mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "…" : mode === "password" ? "Sign in" : "Send magic link"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-serif font-bold text-text tracking-tight">
            O&apos;Boyle Acquisition
          </h1>
          <p className="label-tech mt-1">Operating System</p>
          <p className="text-sm text-text-muted mt-3">Run by Big Stein.</p>
        </div>

        <Suspense fallback={<div className="card p-6 text-sm text-text-muted text-center">Loading…</div>}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-xs text-text-subtle">
          Private system — authorized access only.
        </p>
        <p className="mt-2 text-center text-xs text-text-subtle">
          <Link href="/privacy" className="hover:text-text hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="hover:text-text hover:underline">Terms &amp; Conditions</Link>
        </p>
      </div>
    </div>
  );
}
