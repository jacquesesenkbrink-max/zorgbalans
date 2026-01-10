"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardHomePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setEmail(data.session?.user.email ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEmail(session?.user.email ?? null);
        setLoading(false);
      }
    );
    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Persoonlijke Zorg Dashboard
          </p>
          <h1 className="text-3xl font-semibold">Kies je werkruimte</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Ga naar de jaarplanner of start direct een rapportage.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          {loading ? (
            <p className="text-sm text-zinc-600">Sessiestatus laden...</p>
          ) : email ? (
            <p className="text-sm text-zinc-600">
              Ingelogd als <span className="font-semibold">{email}</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              Je bent niet ingelogd.{" "}
              <a className="font-semibold text-zinc-900" href="/login">
                Log in
              </a>{" "}
              om verder te gaan.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <a
            href="/dashboard/jaarplanner"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300"
          >
            <h2 className="text-lg font-semibold">Jaarplanner</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Plan diensten, verlof en bekijk je saldo over het jaar.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-700">
              Open jaarplanner
            </p>
          </a>
          <a
            href="/dashboard/rapportage"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300"
          >
            <h2 className="text-lg font-semibold">Rapportage</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Maak snel een rapportage met ketting-suggesties en kopieer de tekst.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-700">
              Open rapportage
            </p>
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://je-net.nl/index.html"
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Terug naar website
          </a>
          <a
            href="/login"
            className="text-xs font-semibold text-zinc-700 hover:text-zinc-900"
          >
            Account
          </a>
        </div>
      </main>
    </div>
  );
}
