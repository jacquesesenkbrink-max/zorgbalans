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

type ProfileSettings = {
  contract_hours_week: number;
};

type YearSettings = {
  year: number;
  carryover_hours: number;
};

type MonthTemplate = {
  id: string;
  name: string;
  month_length: number;
};

type MonthTemplateRule = {
  id: string;
  template_id: string;
  rule_type: "weekly" | "biweekly";
  weekdays: number[];
  hours: number;
  interval_weeks: number;
  starts_on: string | null;
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
  const [contractHours, setContractHours] = useState("20");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [carryoverHours, setCarryoverHours] = useState("0");
  const [carryoverLoading, setCarryoverLoading] = useState(false);
  const [carryoverError, setCarryoverError] = useState<string | null>(null);
  const [carryoverBusy, setCarryoverBusy] = useState(false);
  const [templates, setTemplates] = useState<MonthTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("Standaard maand");
  const [templateMonthLength, setTemplateMonthLength] = useState(30);
  const [templateDays, setTemplateDays] = useState<number[]>(
    Array.from({ length: 30 }, () => 0)
  );
  const [templateRules, setTemplateRules] = useState<MonthTemplateRule[]>([]);
  const [ruleType, setRuleType] = useState<"weekly" | "biweekly">("weekly");
  const [ruleWeekdays, setRuleWeekdays] = useState<number[]>([0]);
  const [ruleHours, setRuleHours] = useState("8");
  const [ruleIntervalWeeks, setRuleIntervalWeeks] = useState("2");
  const [ruleStartsOn, setRuleStartsOn] = useState("");
  const [templateRule, setTemplateRule] = useState<
    "overwrite" | "skip" | "only_empty"
  >("skip");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
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
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const months = useMemo<MonthMeta[]>(() => {
    const list: MonthMeta[] = [];
    for (let i = 0; i < 4; i += 1) {
      const date = new Date(selectedYear, monthOffset + i, 1);
      list.push({ year: date.getFullYear(), monthIndex: date.getMonth() });
    }
    return list;
  }, [monthOffset, selectedYear]);

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
    const start = new Date(selectedYear, 0, 1);
    const end = new Date(selectedYear, 11, 31);
    const scheduleByWeekday = new Map<number, BaseScheduleEntry>();
    const contractHoursValue = Number(contractHours);
    const weeklyContract = Number.isNaN(contractHoursValue)
      ? 0
      : contractHoursValue;

    for (const entry of schedule) {
      if (entry.active) {
        scheduleByWeekday.set(entry.weekday, entry);
      }
    }
    const hasSchedule = scheduleByWeekday.size > 0;

    const points: BalancePoint[] = [];
    const carryoverValue = Number(carryoverHours);
    let running = Number.isNaN(carryoverValue) ? 0 : carryoverValue;
    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const iso = formatLocalDate(cursor);
      const weekday = (cursor.getDay() + 6) % 7;
      const closuresForDay = closureMap.get(iso) ?? [];
      const isClosed = closuresForDay.some((closure) => !closure.can_work);
      const fallbackPlanned =
        weekday < 5 ? Number((weeklyContract / 5).toFixed(2)) : 0;
      const planned = isClosed
        ? 0
        : hasSchedule
        ? scheduleByWeekday.get(weekday)?.planned_hours ?? 0
        : fallbackPlanned;
      const actual = entryTotals.get(iso)?.hours ?? 0;
      running = Number((running + (actual - planned)).toFixed(2));
      points.push({ iso, planned, actual, cumulative: running });
    }

    return points;
  }, [entryTotals, schedule, closureMap, contractHours, carryoverHours, selectedYear]);

  const todayBalance = useMemo(() => {
    const todayIso = formatLocalDate(new Date());
    const point = balanceSeries.find((item) => item.iso === todayIso);
    return point?.cumulative ?? 0;
  }, [balanceSeries]);

  const yearEndBalance = useMemo(() => {
    if (balanceSeries.length === 0) return 0;
    return balanceSeries[balanceSeries.length - 1].cumulative;
  }, [balanceSeries]);

  const ytdTotals = useMemo(() => {
    const todayIso = formatLocalDate(new Date());
    const cutoffIso =
      selectedYear === currentYear ? todayIso : `${selectedYear}-12-31`;
    let planned = 0;
    let actual = 0;
    for (const point of balanceSeries) {
      if (point.iso > cutoffIso) break;
      planned += point.planned;
      actual += point.actual;
    }
    return {
      planned: Number(planned.toFixed(2)),
      actual: Number(actual.toFixed(2)),
      delta: Number((actual - planned).toFixed(2)),
    };
  }, [balanceSeries, currentYear, selectedYear]);

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

  function ensureTemplateDays(length: number, existing: number[]) {
    const next = existing.slice(0, length);
    while (next.length < length) {
      next.push(0);
    }
    return next;
  }

  function weekdayLabel(index: number) {
    return ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][index] ?? "-";
  }

  function ruleMatchesDate(rule: MonthTemplateRule, date: Date) {
    const weekday = (date.getDay() + 6) % 7;
    if (!rule.weekdays.includes(weekday)) {
      return false;
    }
    if (rule.rule_type === "weekly") {
      return true;
    }
    if (!rule.starts_on) {
      return false;
    }
    const start = new Date(rule.starts_on);
    const diffDays = Math.floor(
      (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return false;
    }
    const interval = Math.max(1, rule.interval_weeks || 2);
    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks % interval === 0;
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
      loadProfile(userId);
      loadYearSettings(userId, selectedYear);
      loadTemplates(userId);
      loadClosures(userId);
    } else {
      setEntries([]);
      setSchedule([]);
      setContractHours("20");
      setCarryoverHours("0");
      setTemplates([]);
      setTemplateId(null);
      setClosures([]);
    }
  }, [userId, selectedYear]);

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

  async function loadProfile(activeUserId: string) {
    setProfileLoading(true);
    setProfileError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("contract_hours_week")
      .eq("id", activeUserId)
      .maybeSingle();
    if (error) {
      setProfileError(error.message);
      setContractHours("20");
    } else if (!data) {
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: activeUserId,
        contract_hours_week: 20,
      });
      if (upsertError) {
        setProfileError(upsertError.message);
      }
      setContractHours("20");
    } else {
      const value = (data as ProfileSettings).contract_hours_week ?? 20;
      setContractHours(String(value));
    }
    setProfileLoading(false);
  }

  async function loadYearSettings(activeUserId: string, year: number) {
    setCarryoverLoading(true);
    setCarryoverError(null);
    const { data, error } = await supabase
      .from("year_settings")
      .select("year, carryover_hours")
      .eq("user_id", activeUserId)
      .eq("year", year)
      .maybeSingle();
    if (error) {
      setCarryoverError(error.message);
      setCarryoverHours("0");
    } else if (!data) {
      const { error: upsertError } = await supabase
        .from("year_settings")
        .upsert(
          {
            user_id: activeUserId,
            year,
            carryover_hours: 0,
          },
          { onConflict: "user_id,year" }
        );
      if (upsertError) {
        setCarryoverError(upsertError.message);
      }
      setCarryoverHours("0");
    } else {
      const value = (data as YearSettings).carryover_hours ?? 0;
      setCarryoverHours(String(value));
    }
    setCarryoverLoading(false);
  }

  async function loadTemplates(activeUserId: string) {
    setTemplateError(null);
    const { data, error } = await supabase
      .from("month_templates")
      .select("id, name, month_length")
      .eq("user_id", activeUserId)
      .order("name", { ascending: true });
    if (error) {
      setTemplateError(error.message);
      setTemplates([]);
      return;
    }
    const list = (data as MonthTemplate[]) ?? [];
    setTemplates(list);
    if (!templateId && list.length > 0) {
      const first = list[0];
      setTemplateId(first.id);
      setTemplateName(first.name);
      setTemplateMonthLength(first.month_length);
      await loadTemplateDays(first.id, first.month_length);
      await loadTemplateRules(first.id);
    } else if (!templateId && list.length === 0) {
      setTemplateName("Standaard maand");
      setTemplateMonthLength(30);
      setTemplateDays(Array.from({ length: 30 }, () => 0));
      setTemplateRules([]);
    }
  }

  async function loadTemplateDays(id: string, length: number) {
    const { data, error } = await supabase
      .from("month_template_days")
      .select("day_of_month, hours")
      .eq("template_id", id)
      .order("day_of_month", { ascending: true });
    if (error) {
      setTemplateError(error.message);
      setTemplateDays(Array.from({ length }, () => 0));
      return;
    }
    const days = Array.from({ length }, () => 0);
    for (const row of data as { day_of_month: number; hours: number }[]) {
      if (row.day_of_month >= 1 && row.day_of_month <= length) {
        days[row.day_of_month - 1] = row.hours;
      }
    }
    setTemplateDays(days);
  }

  async function loadTemplateRules(id: string) {
    const { data, error } = await supabase
      .from("month_template_rules")
      .select("id, template_id, rule_type, weekdays, hours, interval_weeks, starts_on")
      .eq("template_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      setTemplateError(error.message);
      setTemplateRules([]);
      return;
    }
    setTemplateRules((data as MonthTemplateRule[]) ?? []);
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

  async function handleSaveContract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setProfileError("Je bent niet ingelogd.");
      return;
    }
    const value = Number(contractHours);
    if (Number.isNaN(value) || value < 0 || value > 80) {
      setProfileError("Vul een geldig aantal contracturen in.");
      return;
    }
    setProfileBusy(true);
    setProfileError(null);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      contract_hours_week: value,
    });
    if (error) {
      setProfileError(error.message);
    } else {
      await loadProfile(userId);
    }
    setProfileBusy(false);
  }

  async function handleSaveCarryover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setCarryoverError("Je bent niet ingelogd.");
      return;
    }
    const value = Number(carryoverHours);
    if (Number.isNaN(value) || value < -9999 || value > 9999) {
      setCarryoverError("Vul een geldig saldo in.");
      return;
    }
    setCarryoverBusy(true);
    setCarryoverError(null);
    const { error } = await supabase.from("year_settings").upsert(
      {
        user_id: userId,
        year: selectedYear,
        carryover_hours: value,
      },
      { onConflict: "user_id,year" }
    );
    if (error) {
      setCarryoverError(error.message);
    } else {
      await loadYearSettings(userId, selectedYear);
    }
    setCarryoverBusy(false);
  }

  function handleTemplateLengthChange(value: number) {
    setTemplateMonthLength(value);
    setTemplateDays((current) => ensureTemplateDays(value, current));
  }

  async function handleSelectTemplate(id: string) {
    setTemplateId(id);
    const selected = templates.find((item) => item.id === id);
    if (selected) {
      setTemplateName(selected.name);
      setTemplateMonthLength(selected.month_length);
      await loadTemplateDays(selected.id, selected.month_length);
      await loadTemplateRules(selected.id);
    }
  }

  async function handleSaveTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setTemplateError("Je bent niet ingelogd.");
      return;
    }
    if (!templateName.trim()) {
      setTemplateError("Geef het sjabloon een naam.");
      return;
    }
    setTemplateBusy(true);
    setTemplateError(null);
    let activeId = templateId;
    if (activeId) {
      const { error } = await supabase
        .from("month_templates")
        .update({
          name: templateName.trim(),
          month_length: templateMonthLength,
        })
        .eq("id", activeId);
      if (error) {
        setTemplateError(error.message);
        setTemplateBusy(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("month_templates")
        .insert({
          user_id: userId,
          name: templateName.trim(),
          month_length: templateMonthLength,
        })
        .select("id")
        .single();
      if (error) {
        setTemplateError(error.message);
        setTemplateBusy(false);
        return;
      }
      activeId = (data as { id: string }).id;
      setTemplateId(activeId);
    }

    const daysPayload = Array.from({ length: templateMonthLength }).map(
      (_, index) => ({
        template_id: activeId,
        day_of_month: index + 1,
        hours: Number(templateDays[index] ?? 0),
      })
    );
    const { error: dayError } = await supabase
      .from("month_template_days")
      .upsert(daysPayload, { onConflict: "template_id,day_of_month" });
    if (dayError) {
      setTemplateError(dayError.message);
      setTemplateBusy(false);
      return;
    }

    const { error: cleanupError } = await supabase
      .from("month_template_days")
      .delete()
      .eq("template_id", activeId)
      .gt("day_of_month", templateMonthLength);
    if (cleanupError) {
      setTemplateError(cleanupError.message);
      setTemplateBusy(false);
      return;
    }

    await loadTemplates(userId);
    setTemplateBusy(false);
  }

  async function handleAddRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setTemplateError("Je bent niet ingelogd.");
      return;
    }
    if (!templateId) {
      setTemplateError("Sla eerst het sjabloon op.");
      return;
    }
    if (ruleWeekdays.length === 0) {
      setTemplateError("Kies minimaal 1 weekdag.");
      return;
    }
    const hoursValue = Number(ruleHours);
    if (Number.isNaN(hoursValue) || hoursValue < 0 || hoursValue > 24) {
      setTemplateError("Vul geldige uren in.");
      return;
    }
    if (ruleType === "biweekly" && !ruleStartsOn) {
      setTemplateError("Kies een startdatum voor de 2-weken cyclus.");
      return;
    }
    setTemplateBusy(true);
    setTemplateError(null);
    const intervalValue = Number(ruleIntervalWeeks);
    const { error } = await supabase.from("month_template_rules").insert({
      template_id: templateId,
      rule_type: ruleType,
      weekdays: ruleWeekdays,
      hours: hoursValue,
      interval_weeks:
        ruleType === "biweekly"
          ? Number.isNaN(intervalValue)
            ? 2
            : intervalValue
          : 1,
      starts_on: ruleType === "biweekly" ? ruleStartsOn : null,
    });
    if (error) {
      setTemplateError(error.message);
      setTemplateBusy(false);
      return;
    }
    await loadTemplateRules(templateId);
    setTemplateBusy(false);
  }

  async function handleDeleteRule(ruleId: string) {
    if (!templateId) return;
    setTemplateError(null);
    const { error } = await supabase
      .from("month_template_rules")
      .delete()
      .eq("id", ruleId);
    if (error) {
      setTemplateError(error.message);
    } else {
      await loadTemplateRules(templateId);
    }
  }

  async function handleGenerateYear() {
    if (!userId) {
      setTemplateError("Je bent niet ingelogd.");
      return;
    }
    if (!templateId) {
      setTemplateError("Kies of maak eerst een sjabloon.");
      return;
    }
    setTemplateBusy(true);
    setTemplateError(null);

    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    const entriesByDate = new Map<string, WorkEntry[]>();
    for (const entry of entries) {
      if (entry.work_date.startsWith(`${selectedYear}-`)) {
        const list = entriesByDate.get(entry.work_date) ?? [];
        list.push(entry);
        entriesByDate.set(entry.work_date, list);
      }
    }

    if (templateRule === "overwrite") {
      const { error } = await supabase
        .from("work_entries")
        .delete()
        .eq("user_id", userId)
        .gte("work_date", formatLocalDate(yearStart))
        .lte("work_date", formatLocalDate(yearEnd));
      if (error) {
        setTemplateError(error.message);
        setTemplateBusy(false);
        return;
      }
    }

    const inserts: Array<{
      user_id: string;
      work_date: string;
      hours: number;
      status: "draft";
    }> = [];
    for (
      let cursor = new Date(yearStart);
      cursor <= yearEnd;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const iso = formatLocalDate(cursor);
      const dayOfMonth = cursor.getDate();
      let hours = 0;
      for (const rule of templateRules) {
        if (ruleMatchesDate(rule, cursor)) {
          hours += rule.hours;
        }
      }
      const templateHours = Number(templateDays[dayOfMonth - 1] ?? 0);
      if (templateHours > 0) {
        hours = templateHours;
      }
      const existing = entriesByDate.get(iso) ?? [];
      const isClosed = (closureMap.get(iso) ?? []).some(
        (closure) => !closure.can_work
      );
      if (isClosed) continue;
      if (templateRule === "overwrite") {
        if (hours > 0) {
          inserts.push({ user_id: userId, work_date: iso, hours, status: "draft" });
        }
        continue;
      }
      if (existing.length > 0) {
        continue;
      }
      if (templateRule === "only_empty" && hours <= 0) {
        continue;
      }
      if (hours > 0) {
        inserts.push({ user_id: userId, work_date: iso, hours, status: "draft" });
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("work_entries").insert(inserts);
      if (error) {
        setTemplateError(error.message);
        setTemplateBusy(false);
        return;
      }
    }

    await loadEntries(userId);
    setTemplateBusy(false);
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
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">
                  Jaar
                  <select
                    className="bg-transparent text-xs font-semibold text-zinc-700 focus:outline-none"
                    value={selectedYear}
                    onChange={(event) => {
                      setSelectedYear(Number(event.target.value));
                      setMonthOffset(0);
                    }}
                  >
                    {Array.from({ length: 3 }).map((_, index) => {
                      const yearOption = currentYear - 1 + index;
                      return (
                        <option key={yearOption} value={yearOption}>
                          {yearOption}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={() => setMonthOffset((current) => current - 4)}
                >
                  Vorige 4 maanden
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={() => setMonthOffset(0)}
                >
                  Vandaag
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={() => setMonthOffset((current) => current + 4)}
                >
                  Volgende 4 maanden
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase text-zinc-400">
                  Cumulatief tot vandaag
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {todayBalance}u
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase text-zinc-400">
                  Prognose einde jaar
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">
                  {yearEndBalance}u
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-zinc-400">
                  Werkelijk (YTD)
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {ytdTotals.actual}u
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-zinc-400">
                  Contract (YTD)
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {ytdTotals.planned}u
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-zinc-400">
                  Verschil (YTD)
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {ytdTotals.delta}u
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
                  Datum (geselecteerd)
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
            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Contracturen
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Aantal contracturen per week.
                </span>
              </summary>
              <form
                className="mt-3 flex items-end gap-2"
                onSubmit={handleSaveContract}
              >
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-zinc-700">
                  Uren per week
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="80"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={contractHours}
                    onChange={(event) => setContractHours(event.target.value)}
                    disabled={profileLoading}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  disabled={profileBusy || !hasSession}
                >
                  {profileBusy ? "Opslaan..." : "Opslaan"}
                </button>
              </form>
              {profileError ? (
                <p className="mt-2 text-xs text-rose-600">{profileError}</p>
              ) : null}
              {!hasSession ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Log in om contracturen op te slaan.
                </p>
              ) : null}
            </details>
            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Startsaldo 1 januari
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Plus/min uren van vorig jaar voor {selectedYear}.
                </span>
              </summary>
              <form
                className="mt-3 flex items-end gap-2"
                onSubmit={handleSaveCarryover}
              >
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-zinc-700">
                  Uren
                  <input
                    type="number"
                    step="0.25"
                    min="-9999"
                    max="9999"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={carryoverHours}
                    onChange={(event) => setCarryoverHours(event.target.value)}
                    disabled={carryoverLoading}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  disabled={carryoverBusy || !hasSession}
                >
                  {carryoverBusy ? "Opslaan..." : "Opslaan"}
                </button>
              </form>
              {carryoverError ? (
                <p className="mt-2 text-xs text-rose-600">{carryoverError}</p>
              ) : null}
              {!hasSession ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Log in om het startsaldo op te slaan.
                </p>
              ) : null}
            </details>
            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Maand-sjabloon
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Vul een standaard maand en genereer concept-uren voor het jaar.
                </span>
              </summary>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">
                  Sjabloon
                  <select
                    className="bg-transparent text-xs font-semibold text-zinc-700 focus:outline-none"
                    value={templateId ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        setTemplateId(null);
                        setTemplateName("Standaard maand");
                        setTemplateMonthLength(30);
                        setTemplateDays(Array.from({ length: 30 }, () => 0));
                        return;
                      }
                      handleSelectTemplate(value);
                    }}
                    disabled={!hasSession}
                  >
                    <option value="">Nieuw sjabloon</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={() => {
                    setTemplateId(null);
                    setTemplateName("Standaard maand");
                    setTemplateMonthLength(30);
                    setTemplateDays(Array.from({ length: 30 }, () => 0));
                  }}
                  disabled={!hasSession}
                >
                  Nieuw
                </button>
              </div>
              <form className="mt-3 space-y-3" onSubmit={handleSaveTemplate}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Naam
                    <input
                      type="text"
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      required
                      disabled={!hasSession}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Maandlengte
                    <select
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={templateMonthLength}
                      onChange={(event) =>
                        handleTemplateLengthChange(Number(event.target.value))
                      }
                      disabled={!hasSession}
                    >
                      {[28, 29, 30, 31].map((length) => (
                        <option key={length} value={length}>
                          {length} dagen
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-7 gap-2 text-[11px]">
                  {templateDays.map((hours, index) => (
                    <label
                      key={index}
                      className="flex flex-col items-center gap-1 text-[11px] text-zinc-600"
                    >
                      <span className="text-[10px] text-zinc-500">{index + 1}</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-[11px] focus:border-zinc-400 focus:outline-none"
                        value={hours}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setTemplateDays((current) => {
                            const next = [...current];
                            next[index] = Number.isNaN(value) ? 0 : value;
                            return next;
                          });
                        }}
                        disabled={!hasSession}
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">
                    Overwrite
                    <select
                      className="bg-transparent text-xs font-semibold text-zinc-700 focus:outline-none"
                      value={templateRule}
                      onChange={(event) =>
                        setTemplateRule(
                          event.target.value as "overwrite" | "skip" | "only_empty"
                        )
                      }
                      disabled={!hasSession}
                    >
                      <option value="overwrite">Overschrijven</option>
                      <option value="skip">Overslaan</option>
                      <option value="only_empty">Alleen lege dagen</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                    disabled={templateBusy || !hasSession}
                  >
                    {templateBusy ? "Opslaan..." : "Sjabloon opslaan"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
                    onClick={handleGenerateYear}
                    disabled={templateBusy || !hasSession}
                  >
                    {templateBusy ? "Bezig..." : "Vul jaar met concept-uren"}
                  </button>
                </div>
                {templateRule === "overwrite" ? (
                  <p className="text-[11px] text-rose-600">
                    Let op: overschrijven vervangt bestaande dagen (ook definitief).
                  </p>
                ) : null}
                {templateError ? (
                  <p className="text-xs text-rose-600">{templateError}</p>
                ) : null}
                {!hasSession ? (
                  <p className="text-xs text-zinc-500">
                    Log in om sjablonen op te slaan of toe te passen.
                  </p>
                ) : null}
              </form>
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-700">
                  Regels (weekpatroon)
                </p>
                <form className="space-y-2" onSubmit={handleAddRule}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">
                      Type
                      <select
                        className="bg-transparent text-xs font-semibold text-zinc-700 focus:outline-none"
                        value={ruleType}
                        onChange={(event) =>
                          setRuleType(event.target.value as "weekly" | "biweekly")
                        }
                        disabled={!hasSession}
                      >
                        <option value="weekly">Wekelijks</option>
                        <option value="biweekly">Om de week</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">
                      Uren
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        className="w-16 bg-transparent text-xs font-semibold text-zinc-700 focus:outline-none"
                        value={ruleHours}
                        onChange={(event) => setRuleHours(event.target.value)}
                        disabled={!hasSession}
                      />
                    </label>
                    {ruleType === "biweekly" ? (
                      <>
                        <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">
                          Start
                          <input
                            type="date"
                            className="bg-transparent text-xs font-semibold text-zinc-700 focus:outline-none"
                            value={ruleStartsOn}
                            onChange={(event) => setRuleStartsOn(event.target.value)}
                            disabled={!hasSession}
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">
                          Interval
                          <input
                            type="number"
                            min="2"
                            max="4"
                            className="w-10 bg-transparent text-xs font-semibold text-zinc-700 focus:outline-none"
                            value={ruleIntervalWeeks}
                            onChange={(event) =>
                              setRuleIntervalWeeks(event.target.value)
                            }
                            disabled={!hasSession}
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Array.from({ length: 7 }).map((_, index) => {
                      const isChecked = ruleWeekdays.includes(index);
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                            isChecked
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-700"
                          }`}
                          onClick={() => {
                            setRuleWeekdays((current) =>
                              current.includes(index)
                                ? current.filter((day) => day !== index)
                                : [...current, index].sort()
                            );
                          }}
                          disabled={!hasSession}
                        >
                          {weekdayLabel(index)}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                    disabled={templateBusy || !hasSession}
                  >
                    {templateBusy ? "Opslaan..." : "Regel toevoegen"}
                  </button>
                </form>
                {templateRules.length === 0 ? (
                  <p className="text-xs text-zinc-500">Nog geen regels.</p>
                ) : (
                  <div className="space-y-2 text-xs text-zinc-600">
                    {templateRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold text-zinc-800">
                            {rule.rule_type === "weekly"
                              ? "Wekelijks"
                              : "Om de week"}
                            {" - "}
                            {rule.weekdays.map((day) => weekdayLabel(day)).join(", ")}
                            {" - "}
                            {rule.hours}u
                          </p>
                          {rule.rule_type === "biweekly" && rule.starts_on ? (
                            <p className="text-xs text-zinc-500">
                              Start: {rule.starts_on} (interval {rule.interval_weeks})
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-300"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          Verwijder
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Basisrooster
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Stel je vaste weekpatroon in.
                </span>
              </summary>
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
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Sluitingsdagen
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Geef aan wanneer het bedrijf gesloten is.
                </span>
              </summary>
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
            </details>
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
