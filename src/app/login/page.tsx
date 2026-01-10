"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const helperText = useMemo(() => {
    if (mode === "signup") {
      return "We sturen een bevestigingsmail om je account te activeren.";
    }
    return "Log in met je e-mailadres en wachtwoord.";
  }, [mode]);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSessionEmail(session?.user.email ?? null);
      }
    );
    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setStatus("Check je e-mail om je account te bevestigen.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setStatus("Je bent ingelogd.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Er ging iets mis.";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Je bent uitgelogd.");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            ZorgBalans
          </p>
          <h1 className="text-3xl font-semibold">
            {sessionEmail
              ? "Je bent ingelogd"
              : "Persoonlijk Zorg Dashboard"}
          </h1>
          <p className="text-sm text-zinc-600">
            {sessionEmail
              ? "Je persoonlijke tools voor de zorg, overzichtelijk bij elkaar."
              : "Alle persoonlijke tools voor de zorgverlener, overzichtelijk op één plek."}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {sessionEmail ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-600">
                Ingelogd als <span className="font-semibold">{sessionEmail}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Naar dashboard
                </a>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
                  disabled={busy}
                >
                  Uitloggen
                </button>
              </div>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                E-mail
                <input
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Wachtwoord
                <input
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                  type="password"
                  name="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  disabled={busy}
                >
                  {mode === "signup" ? "Account maken" : "Inloggen"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
                  onClick={() =>
                    setMode(mode === "signup" ? "signin" : "signup")
                  }
                  disabled={busy}
                >
                  {mode === "signup" ? "Naar inloggen" : "Naar registreren"}
                </button>
              </div>
            </form>
          )}
        </div>

        {status ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
            {status}
          </p>
        ) : null}
      </main>
    </div>
  );
}
