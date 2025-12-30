"use client";

import { useEffect, useMemo, useState } from "react";
import Holidays from "date-holidays";
import { supabase } from "@/lib/supabaseClient";

type WorkEntry = {
  id: string;
  work_date: string;
  hours: number;
  status: "draft" | "final";
  notes: string | null;
};

type BaseScheduleEntry = {
  id: string;
  weekday: number;
  planned_hours: number;
  active: boolean;
  notes: string | null;
};

type Closure = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  can_work: boolean;
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

type BalancePoint = {
  iso: string;
  planned: number;
  actual: number;
  cumulative: number;
};

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(true);
  const [showFinal, setShowFinal] = useState(true);
  const [schedule, setSchedule] = useState<BaseScheduleEntry[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(false);
  const [closuresError, setClosuresError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formHours, setFormHours] = useState("8");
  const [formStatus, setFormStatus] = useState<"draft" | "final">("draft");
  const [formNotes, setFormNotes] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [scheduleWeekday, setScheduleWeekday] = useState("0");
  const [scheduleHours, setScheduleHours] = useState("8");
  const [scheduleActive, setScheduleActive] = useState(true);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [closureCanWork, setClosureCanWork] = useState(false);
  const [closureBusy, setClosureBusy] = useState(false);

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

  useEffect(() => {
    if (!selectedDate) {
      const today = formatLocalDate(new Date());
      setSelectedDate(today);
      if (!formDate) {
        setFormDate(today);
      }
    }
  }, [selectedDate, formDate]);

  const hasSession = useMemo(() => Boolean(email && userId), [email, userId]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.status === "draft" && !showDraft) return false;
      if (entry.status === "final" && !showFinal) return false;
      return true;
    });
  }, [entries, showDraft, showFinal]);

  const entryTotals = useMemo(() => {
    const totals = new Map<
      string,
      { hours: number; hasDraft: boolean; hasFinal: boolean }
    >();
    for (const entry of filteredEntries) {
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
  }, [filteredEntries]);

  const [monthOffset, setMonthOffset] = useState(0);

  const months = useMemo<MonthMeta[]>(() => {
    const now = new Date();
    const list: MonthMeta[] = [];
    for (let i = 0; i < 4; i += 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() + monthOffset + i,
        1
      );
      list.push({ year: date.getFullYear(), monthIndex: date.getMonth() });
    }
    return list;
  }, [monthOffset]);

  const calendarRange = useMemo(() => {
    if (months.length === 0) return null;
    const first = months[0];
    const last = months[months.length - 1];
    const start = new Date(first.year, first.monthIndex, 1);
    const end = new Date(last.year, last.monthIndex + 1, 0);
    return { start, end };
  }, [months]);

  const holidayMap = useMemo(() => {
    if (!calendarRange) return new Map<string, string>();
    const hd = new Holidays("NL");
    hd.setLanguages("nl");
    const map = new Map<string, string>();
    const years = new Set<number>();
    for (const month of months) {
      years.add(month.year);
    }
    for (const year of years) {
      const holidays = hd.getHolidays(year);
      for (const holiday of holidays) {
        const date = new Date(holiday.date);
        if (date < calendarRange.start || date > calendarRange.end) {
          continue;
        }
        const iso = formatLocalDate(date);
        map.set(iso, holiday.name);
      }
    }
    return map;
  }, [calendarRange, months]);

  const closureMap = useMemo(() => {
    const map = new Map<string, Closure[]>();
    for (const closure of closures) {
      const start = new Date(closure.start_date);
      const end = new Date(closure.end_date);
      for (
        let cursor = new Date(start);
        cursor <= end;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const iso = formatLocalDate(cursor);
        const list = map.get(iso) ?? [];
        list.push(closure);
        map.set(iso, list);
      }
    }
    return map;
  }, [closures]);

  const balanceSeries = useMemo<BalancePoint[]>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const scheduleByWeekday = new Map<number, BaseScheduleEntry>();

    for (const entry of schedule) {
      if (entry.active) {
        scheduleByWeekday.set(entry.weekday, entry);
      }
    }

    const points: BalancePoint[] = [];
    let running = 0;
    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const iso = formatLocalDate(cursor);
      const weekday = (cursor.getDay() + 6) % 7;
      const closuresForDay = closureMap.get(iso) ?? [];
      const isClosed = closuresForDay.some((closure) => !closure.can_work);
      const planned = isClosed
        ? 0
        : scheduleByWeekday.get(weekday)?.planned_hours ?? 0;
      const actual = entryTotals.get(iso)?.hours ?? 0;
      running = Number((running + (actual - planned)).toFixed(2));
      points.push({ iso, planned, actual, cumulative: running });
    }

    return points;
  }, [entryTotals, schedule, closureMap]);

  const todayBalance = useMemo(() => {
    const todayIso = formatLocalDate(new Date());
    const point = balanceSeries.find((item) => item.iso === todayIso);
    return point?.cumulative ?? 0;
  }, [balanceSeries]);

  const yearEndBalance = useMemo(() => {
    if (balanceSeries.length === 0) return 0;
    return balanceSeries[balanceSeries.length - 1].cumulative;
  }, [balanceSeries]);

  const selectedEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entries.filter((entry) => entry.work_date === selectedDate);
  }, [entries, selectedDate]);

  const selectedHoliday = useMemo(() => {
    if (!selectedDate) return null;
    return holidayMap.get(selectedDate) ?? null;
  }, [holidayMap, selectedDate]);

  const selectedClosures = useMemo(() => {
    if (!selectedDate) return [];
    return closureMap.get(selectedDate) ?? [];
  }, [closureMap, selectedDate]);

  function handleSelectDate(iso: string) {
    setSelectedDate(iso);
    setFormDate(iso);
    setEditingEntryId(null);
  }

  function buildMonthCells({ year, monthIndex }: MonthMeta): DayCell[] {
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
    const cells: DayCell[] = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      const date = new Date(year, monthIndex, i - firstWeekday + 1);
      cells.push({
        date,
        iso: formatLocalDate(date),
        inMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, monthIndex, day);
      cells.push({
        date,
        iso: formatLocalDate(date),
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

  function formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
      loadSchedule(userId);
      loadClosures(userId);
    } else {
      setEntries([]);
      setSchedule([]);
      setClosures([]);
    }
  }, [userId]);

  async function loadSchedule(activeUserId: string) {
    setScheduleLoading(true);
    setScheduleError(null);
    const { data, error } = await supabase
      .from("base_schedule")
      .select("id, weekday, planned_hours, active, notes")
      .eq("user_id", activeUserId)
      .order("weekday", { ascending: true });
    if (error) {
      setScheduleError(error.message);
      setSchedule([]);
    } else {
      setSchedule((data as BaseScheduleEntry[]) ?? []);
    }
    setScheduleLoading(false);
  }

  async function loadClosures(activeUserId: string) {
    setClosuresLoading(true);
    setClosuresError(null);
    const { data, error } = await supabase
      .from("closures")
      .select("id, start_date, end_date, reason, can_work")
      .eq("user_id", activeUserId)
      .order("start_date", { ascending: true });
    if (error) {
      setClosuresError(error.message);
      setClosures([]);
    } else {
      setClosures((data as Closure[]) ?? []);
    }
    setClosuresLoading(false);
  }

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
    const payload = {
      user_id: userId,
      work_date: formDate,
      hours: hoursValue,
      status: formStatus,
      notes: formNotes.trim() ? formNotes.trim() : null,
    };
    const { error } = editingEntryId
      ? await supabase.from("work_entries").update(payload).eq("id", editingEntryId)
      : await supabase.from("work_entries").insert(payload);
    if (error) {
      setEntriesError(error.message);
    } else {
      setFormNotes("");
      setEditingEntryId(null);
      await loadEntries(userId);
    }
    setFormBusy(false);
  }

  async function handleSaveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setScheduleError("Je bent niet ingelogd.");
      return;
    }
    setScheduleBusy(true);
    setScheduleError(null);
    const weekdayValue = Number(scheduleWeekday);
    const hoursValue = Number(scheduleHours);
    if (Number.isNaN(weekdayValue) || Number.isNaN(hoursValue)) {
      setScheduleError("Vul een geldige weekdag en uren in.");
      setScheduleBusy(false);
      return;
    }

    const existing = schedule.find((entry) => entry.weekday === weekdayValue);
    const payload = {
      user_id: userId,
      weekday: weekdayValue,
      planned_hours: hoursValue,
      active: scheduleActive,
      notes: scheduleNotes.trim() ? scheduleNotes.trim() : null,
    };

    const { error } = existing
      ? await supabase.from("base_schedule").update(payload).eq("id", existing.id)
      : await supabase.from("base_schedule").insert(payload);

    if (error) {
      setScheduleError(error.message);
    } else {
      setScheduleNotes("");
      await loadSchedule(userId);
    }
    setScheduleBusy(false);
  }

  async function handleDeleteEntry(entryId: string) {
    if (!userId) return;
    setEntriesError(null);
    const { error } = await supabase.from("work_entries").delete().eq("id", entryId);
    if (error) {
      setEntriesError(error.message);
    } else {
      await loadEntries(userId);
    }
  }

  function handleEditEntry(entry: WorkEntry) {
    setEditingEntryId(entry.id);
    setFormDate(entry.work_date);
    setFormHours(String(entry.hours));
    setFormStatus(entry.status);
    setFormNotes(entry.notes ?? "");
  }

  function handleCancelEdit() {
    setEditingEntryId(null);
    setFormNotes("");
    if (selectedDate) {
      setFormDate(selectedDate);
    }
  }

  async function handleAddClosure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setClosuresError("Je bent niet ingelogd.");
      return;
    }
    if (!closureStart || !closureEnd) {
      setClosuresError("Vul een start- en einddatum in.");
      return;
    }
    setClosureBusy(true);
    setClosuresError(null);
    const { error } = await supabase.from("closures").insert({
      user_id: userId,
      start_date: closureStart,
      end_date: closureEnd,
      reason: closureReason.trim() ? closureReason.trim() : null,
      can_work: closureCanWork,
    });
    if (error) {
      setClosuresError(error.message);
    } else {
      setClosureReason("");
      setClosureCanWork(false);
      await loadClosures(userId);
    }
    setClosureBusy(false);
  }

  async function handleDeleteClosure(closureId: string) {
    if (!userId) return;
    setClosuresError(null);
    const { error } = await supabase.from("closures").delete().eq("id", closureId);
    if (error) {
      setClosuresError(error.message);
    } else {
      await loadClosures(userId);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Dashboard
            </p>
            <h1 className="text-xl font-semibold">Jaarplanner</h1>
          </div>
          <a
            href="/login"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
          >
            Account
          </a>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">4-maanden overzicht</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Overzicht van geplande uren, concept en definitief.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={() => setMonthOffset((current) => current - 4)}
                >
                  Vorige 4 maanden
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={() => setMonthOffset(0)}
                >
                  Vandaag
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={() => setMonthOffset((current) => current + 4)}
                >
                  Volgende 4 maanden
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase text-zinc-400">
                  Cumulatief tot vandaag
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {todayBalance}u
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase text-zinc-400">
                  Prognose einde jaar
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {yearEndBalance}u
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1">
                <input
                  type="checkbox"
                  checked={showDraft}
                  onChange={(event) => setShowDraft(event.target.checked)}
                />
                Concept
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1">
                <input
                  type="checkbox"
                  checked={showFinal}
                  onChange={(event) => setShowFinal(event.target.checked)}
                />
                Definitief
              </label>
              <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Feestdag
              </span>
              <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Gesloten
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {months.map((month) => {
                const cells = buildMonthCells(month);
                return (
                  <div
                    key={`${month.year}-${month.monthIndex}`}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
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
                    <div className="grid grid-cols-7 gap-1 text-[11px]">
                      {cells.map((cell) => {
                        const totals = entryTotals.get(cell.iso);
                        const hasFinal = totals?.hasFinal ?? false;
                        const hasDraft = totals?.hasDraft ?? false;
                        const hours = totals?.hours ?? 0;
                        const holiday = holidayMap.get(cell.iso);
                        const closuresForDay = closureMap.get(cell.iso) ?? [];
                        const tone = hasFinal
                          ? "bg-emerald-100 text-emerald-900"
                          : hasDraft
                          ? "bg-amber-100 text-amber-900"
                          : "bg-white text-zinc-500";
                        const isSelected = cell.iso === selectedDate;
                        return (
                          <button
                            type="button"
                            key={cell.iso}
                            onClick={() => handleSelectDate(cell.iso)}
                            className={`flex h-10 flex-col items-center justify-center rounded-lg border px-1 ${tone} ${
                              cell.inMonth ? "" : "opacity-40"
                            } ${isSelected ? "border-zinc-900" : "border-zinc-200"}`}
                          >
                            <span className="text-sm font-semibold">
                              {cell.date.getDate()}
                            </span>
                            {hours > 0 ? (
                              <span className="text-[11px] font-semibold">
                                {hours}u
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">-</span>
                            )}
                            <span className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400">
                              {holiday ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                              ) : null}
                              {closuresForDay.length > 0 ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <h2 className="text-base font-semibold">Dagdetails</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Klik op een dag in de kalender om details te bekijken of te bewerken.
              </p>
              {selectedDate ? (
                <div className="mt-4 space-y-3 text-sm text-zinc-600">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-zinc-400">
                      Geselecteerde dag
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-800">
                      {new Date(selectedDate).toLocaleDateString("nl-NL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {selectedHoliday ? (
                      <p className="mt-1 text-xs text-sky-700">
                        Feestdag: {selectedHoliday}
                      </p>
                    ) : null}
                    {selectedClosures.length > 0 ? (
                      <div className="mt-1 text-xs text-rose-700">
                        <p>Bedrijf gesloten</p>
                        {selectedClosures.map((closure) => (
                          <p key={closure.id} className="text-rose-600">
                            {closure.reason ? closure.reason : "Geen reden"}
                            {closure.can_work ? " - Kan werken" : ""}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {selectedEntries.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        Nog geen diensten voor deze dag.
                      </p>
                    ) : (
                      selectedEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-zinc-800">
                              {entry.hours}u -{" "}
                              {entry.status === "final" ? "Definitief" : "Concept"}
                            </p>
                            {entry.notes ? (
                              <p className="text-xs text-zinc-500">
                                {entry.notes}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              className="rounded-full border border-zinc-200 px-3 py-1 font-semibold text-zinc-700 hover:border-zinc-300"
                              onClick={() => handleEditEntry(entry)}
                            >
                              Bewerk
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-700 hover:border-rose-300"
                              onClick={() => handleDeleteEntry(entry.id)}
                            >
                              Verwijder
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Geen dag geselecteerd.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <h2 className="text-base font-semibold">Nieuwe uren</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Voeg een concept of definitieve dienst toe.
              </p>
              {editingEntryId ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  Bewerken: je past een bestaande dienst aan.
                </p>
              ) : null}
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleAddEntry}
              >
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Datum
                  <input
                    type="date"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
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
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={formHours}
                    onChange={(event) => setFormHours(event.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Status
                  <select
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
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
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={formNotes}
                    onChange={(event) => setFormNotes(event.target.value)}
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                    disabled={formBusy || !hasSession}
                  >
                    {formBusy
                      ? "Opslaan..."
                      : editingEntryId
                      ? "Uren bijwerken"
                      : "Uren opslaan"}
                  </button>
                  {editingEntryId ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300"
                      onClick={handleCancelEdit}
                      disabled={formBusy}
                    >
                      Annuleren
                    </button>
                  ) : null}
                </div>
                {!hasSession ? (
                  <p className="text-xs text-zinc-500">
                    Log in om uren op te slaan.
                  </p>
                ) : null}
              </form>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <h2 className="text-base font-semibold">Basisrooster</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Stel je vaste weekpatroon in.
              </p>
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleSaveSchedule}
              >
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Weekdag
                  <select
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={scheduleWeekday}
                    onChange={(event) => setScheduleWeekday(event.target.value)}
                  >
                    <option value="0">Maandag</option>
                    <option value="1">Dinsdag</option>
                    <option value="2">Woensdag</option>
                    <option value="3">Donderdag</option>
                    <option value="4">Vrijdag</option>
                    <option value="5">Zaterdag</option>
                    <option value="6">Zondag</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Geplande uren
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={scheduleHours}
                    onChange={(event) => setScheduleHours(event.target.value)}
                    required
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={scheduleActive}
                    onChange={(event) => setScheduleActive(event.target.checked)}
                  />
                  Actief
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Opmerking (optioneel)
                  <input
                    type="text"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={scheduleNotes}
                    onChange={(event) => setScheduleNotes(event.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  disabled={scheduleBusy || !hasSession}
                >
                  {scheduleBusy ? "Opslaan..." : "Basisrooster opslaan"}
                </button>
                {!hasSession ? (
                  <p className="text-xs text-zinc-500">
                    Log in om je basisrooster op te slaan.
                  </p>
                ) : null}
                {scheduleError ? (
                  <p className="text-xs text-rose-600">{scheduleError}</p>
                ) : null}
              </form>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                {scheduleLoading ? (
                  <p>Basisrooster laden...</p>
                ) : schedule.length === 0 ? (
                  <p>Nog geen basisrooster ingesteld.</p>
                ) : (
                  schedule.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-zinc-800">
                          {[
                            "Maandag",
                            "Dinsdag",
                            "Woensdag",
                            "Donderdag",
                            "Vrijdag",
                            "Zaterdag",
                            "Zondag",
                          ][entry.weekday] ?? "Onbekend"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {entry.active ? "Actief" : "Inactief"}
                          {entry.notes ? ` - ${entry.notes}` : ""}
                        </p>
                      </div>
                      <span className="font-semibold">{entry.planned_hours}u</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <h2 className="text-base font-semibold">Sluitingsdagen</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Geef aan wanneer het bedrijf gesloten is.
              </p>
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleAddClosure}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                    Startdatum
                    <input
                      type="date"
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={closureStart}
                      onChange={(event) => setClosureStart(event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                    Einddatum
                    <input
                      type="date"
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={closureEnd}
                      onChange={(event) => setClosureEnd(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Reden (optioneel)
                  <input
                    type="text"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={closureReason}
                    onChange={(event) => setClosureReason(event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={closureCanWork}
                    onChange={(event) => setClosureCanWork(event.target.checked)}
                  />
                  Ik kan eventueel werken als inval
                </label>
                <button
                  type="submit"
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  disabled={closureBusy || !hasSession}
                >
                  {closureBusy ? "Opslaan..." : "Sluiting opslaan"}
                </button>
                {!hasSession ? (
                  <p className="text-xs text-zinc-500">
                    Log in om sluitingen op te slaan.
                  </p>
                ) : null}
                {closuresError ? (
                  <p className="text-xs text-rose-600">{closuresError}</p>
                ) : null}
              </form>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                {closuresLoading ? (
                  <p>Sluitingsdagen laden...</p>
                ) : closures.length === 0 ? (
                  <p>Nog geen sluitingsdagen ingesteld.</p>
                ) : (
                  closures.map((closure) => (
                    <div
                      key={closure.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-zinc-800">
                          {closure.start_date} t/m {closure.end_date}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {closure.reason ? closure.reason : "Geen reden"}
                          {closure.can_work ? " - Kan werken" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-300"
                        onClick={() => handleDeleteClosure(closure.id)}
                      >
                        Verwijder
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <h2 className="text-base font-semibold">Jouw diensten</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Concept en definitieve uren voor dit jaar.
            </p>
            <div className="mt-4 space-y-3">
              {entriesLoading ? (
                <p className="text-sm text-zinc-600">Laden...</p>
              ) : entriesError ? (
                <p className="text-sm text-rose-600">{entriesError}</p>
              ) : filteredEntries.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nog geen diensten toegevoegd.
                </p>
              ) : (
                filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold">{entry.work_date}</p>
                      <p className="text-xs text-zinc-500">
                        {entry.status === "final" ? "Definitief" : "Concept"}
                        {entry.notes ? ` - ${entry.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{entry.hours}u</span>
                      <button
                        type="button"
                        className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:border-zinc-300"
                        onClick={() => handleEditEntry(entry)}
                      >
                        Bewerk
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-300"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        Verwijder
                      </button>
                    </div>
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
