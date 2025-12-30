"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
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
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold">Jaarplanner</h1>
          </div>
          <a
            href="/login"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
          >
            Account
          </a>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
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
              om je planning te bekijken.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
            Hier komt het 6‑maanden kalender‑overzicht.
          </div>
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
            Hier komt het cumulatieve saldo en dagdetails.
          </div>
        </div>
      </main>
    </div>
  );
}
