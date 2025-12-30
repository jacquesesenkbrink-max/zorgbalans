"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type WorkEntry = {
  id: string;
  work_date: string;
  hours: number;
  status: "draft" | "final";
  notes: string | null;
};

type MonthMeta = {
  year: number;
  monthIndex: number;
};

type DayCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
};

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formHours, setFormHours] = useState("8");
  const [formStatus, setFormStatus] = useState<"draft" | "final">("draft");
  const [formNotes, setFormNotes] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEmail(session?.user.email ?? null);
        setUserId(session?.user.id ?? null);
        setLoading(false);
      }
    );
    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const hasSession = useMemo(() => Boolean(email && userId), [email, userId]);

  const entryTotals = useMemo(() => {
    const totals = new Map<
      string,
      { hours: number; hasDraft: boolean; hasFinal: boolean }
    >();
    for (const entry of entries) {
      const current = totals.get(entry.work_date) ?? {
        hours: 0,
        hasDraft: false,
        hasFinal: false,
      };
      totals.set(entry.work_date, {
        hours: Number((current.hours + entry.hours).toFixed(2)),
        hasDraft: current.hasDraft || entry.status === "draft",
        hasFinal: current.hasFinal || entry.status === "final",
      });
    }
    return totals;
  }, [entries]);

  const months = useMemo<MonthMeta[]>(() => {
    const now = new Date();
    const list: MonthMeta[] = [];
    for (let i = 0; i < 6; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      list.push({ year: date.getFullYear(), monthIndex: date.getMonth() });
    }
    return list;
  }, []);

  function buildMonthCells({ year, monthIndex }: MonthMeta): DayCell[] {
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
    const cells: DayCell[] = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      const date = new Date(year, monthIndex, i - firstWeekday + 1);
      cells.push({
        date,
        iso: date.toISOString().slice(0, 10),
        inMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, monthIndex, day);
      cells.push({
        date,
        iso: date.toISOString().slice(0, 10),
        inMonth: true,
      });
    }

    return cells;
  }

  function monthLabel({ year, monthIndex }: MonthMeta) {
    const date = new Date(year, monthIndex, 1);
    return date.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    });
  }

  async function loadEntries(activeUserId: string) {
    setEntriesLoading(true);
    setEntriesError(null);
    const { data, error } = await supabase
      .from("work_entries")
      .select("id, work_date, hours, status, notes")
      .eq("user_id", activeUserId)
      .order("work_date", { ascending: true });
    if (error) {
      setEntriesError(error.message);
      setEntries([]);
    } else {
      setEntries((data as WorkEntry[]) ?? []);
    }
    setEntriesLoading(false);
  }

  useEffect(() => {
    if (userId) {
      loadEntries(userId);
    } else {
      setEntries([]);
    }
  }, [userId]);

  async function handleAddEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setEntriesError("Je bent niet ingelogd.");
      return;
    }
    setFormBusy(true);
    setEntriesError(null);
    const hoursValue = Number(formHours);
    if (!formDate || Number.isNaN(hoursValue)) {
      setEntriesError("Vul een datum en geldige uren in.");
      setFormBusy(false);
      return;
    }
    const { error } = await supabase.from("work_entries").insert({
      user_id: userId,
      work_date: formDate,
      hours: hoursValue,
      status: formStatus,
      notes: formNotes.trim() ? formNotes.trim() : null,
    });
    if (error) {
      setEntriesError(error.message);
    } else {
      setFormNotes("");
      await loadEntries(userId);
    }
    setFormBusy(false);
  }

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
          ) : hasSession ? (
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">6-maanden overzicht</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Overzicht van geplande uren, concept en definitief.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {months.map((month) => {
                const cells = buildMonthCells(month);
                return (
                  <div
                    key={`${month.year}-${month.monthIndex}`}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <p className="text-sm font-semibold capitalize text-zinc-700">
                      {monthLabel(month)}
                    </p>
                    <div className="mt-3 grid grid-cols-7 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map(
                        (label) => (
                          <div key={label} className="py-1 text-center">
                            {label}
                          </div>
                        )
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-xs">
                      {cells.map((cell) => {
                        const totals = entryTotals.get(cell.iso);
                        const hasFinal = totals?.hasFinal ?? false;
                        const hasDraft = totals?.hasDraft ?? false;
                        const hours = totals?.hours ?? 0;
                        const tone = hasFinal
                          ? "bg-emerald-100 text-emerald-900"
                          : hasDraft
                          ? "bg-amber-100 text-amber-900"
                          : "bg-white text-zinc-500";
                        return (
                          <div
                            key={cell.iso}
                            className={`flex h-16 flex-col items-center justify-center rounded-lg border border-zinc-200 px-1 ${tone} ${
                              cell.inMonth ? "" : "opacity-40"
                            }`}
                          >
                            <span className="text-sm font-semibold">
                              {cell.date.getDate()}
                            </span>
                            {hours > 0 ? (
                              <span className="text-[11px] font-semibold">
                                {hours}u
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">
                                —
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Nieuwe uren</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Voeg een concept of definitieve dienst toe.
            </p>
            <form className="mt-4 flex flex-col gap-3" onSubmit={handleAddEntry}>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Datum
                <input
                  type="date"
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                  value={formDate}
                  onChange={(event) => setFormDate(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Uren
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                  value={formHours}
                  onChange={(event) => setFormHours(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Status
                <select
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                  value={formStatus}
                  onChange={(event) =>
                    setFormStatus(event.target.value as "draft" | "final")
                  }
                >
                  <option value="draft">Concept</option>
                  <option value="final">Definitief</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Opmerking (optioneel)
                <input
                  type="text"
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                  value={formNotes}
                  onChange={(event) => setFormNotes(event.target.value)}
                />
              </label>
              <button
                type="submit"
                className="mt-2 inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                disabled={formBusy || !hasSession}
              >
                {formBusy ? "Opslaan..." : "Uren opslaan"}
              </button>
              {!hasSession ? (
                <p className="text-xs text-zinc-500">
                  Log in om uren op te slaan.
                </p>
              ) : null}
            </form>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Jouw diensten</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Concept en definitieve uren voor dit jaar.
            </p>
            <div className="mt-4 space-y-3">
              {entriesLoading ? (
                <p className="text-sm text-zinc-600">Laden...</p>
              ) : entriesError ? (
                <p className="text-sm text-rose-600">{entriesError}</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nog geen diensten toegevoegd.
                </p>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{entry.work_date}</p>
                      <p className="text-xs text-zinc-500">
                        {entry.status === "final" ? "Definitief" : "Concept"}
                        {entry.notes ? ` · ${entry.notes}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold">{entry.hours}u</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
