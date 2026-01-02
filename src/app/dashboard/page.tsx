"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Holidays from "date-holidays";
import { supabase } from "@/lib/supabaseClient";

type WorkEntry = {
  id: string;
  work_date: string;
  hours: number;
  status: "draft" | "final";
  shift_type: "day" | "evening" | "night" | "kto" | null;
  notes: string | null;
};

type ProfileSettings = {
  contract_hours_week: number;
};

type YearSettings = {
  year: number;
  carryover_hours: number;
};

type Closure = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  can_work: boolean;
};

type Vacation = {
  id: string;
  start_date: string;
  end_date: string;
  name: string | null;
  kind: "region" | "personal";
};

type LeaveEntry = {
  id: string;
  leave_date: string;
  hours: number;
  leave_type: "regular" | "balance";
  notes: string | null;
};

type LeaveBalances = {
  year: number;
  regular_hours: number;
  balance_hours: number;
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

type UndoAction = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
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
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(false);
  const [closuresError, setClosuresError] = useState<string | null>(null);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [vacationsLoading, setVacationsLoading] = useState(false);
  const [vacationsError, setVacationsError] = useState<string | null>(null);
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formHours, setFormHours] = useState("8");
  const [formStatus, setFormStatus] = useState<"draft" | "final">("draft");
  const [formShiftType, setFormShiftType] = useState<
    "day" | "evening" | "night" | "kto"
  >("day");
  const [formNotes, setFormNotes] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [contractHours, setContractHours] = useState("20");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [carryoverHours, setCarryoverHours] = useState("0");
  const [carryoverLoading, setCarryoverLoading] = useState(false);
  const [carryoverError, setCarryoverError] = useState<string | null>(null);
  const [carryoverBusy, setCarryoverBusy] = useState(false);
  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [closureCanWork, setClosureCanWork] = useState(false);
  const [closureBusy, setClosureBusy] = useState(false);
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationName, setVacationName] = useState("");
  const [vacationKind, setVacationKind] = useState<"region" | "personal">(
    "region"
  );
  const [vacationBusy, setVacationBusy] = useState(false);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveHours, setLeaveHours] = useState("");
  const [leaveType, setLeaveType] = useState<"regular" | "balance">("regular");
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveRegularHours, setLeaveRegularHours] = useState("0");
  const [leaveBalanceHours, setLeaveBalanceHours] = useState("0");
  const [leaveBalancesLoading, setLeaveBalancesLoading] = useState(false);
  const [leaveBalancesError, setLeaveBalancesError] = useState<string | null>(
    null
  );
  const [leaveBalancesBusy, setLeaveBalancesBusy] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2026);
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const contractHoursRef = useRef("20");
  const carryoverRef = useRef("0");
  const leaveRegularRef = useRef("0");
  const leaveBalanceRef = useRef("0");
  const [legendFocus, setLegendFocus] = useState<
    | "holiday"
    | "vacation_region"
    | "vacation_personal"
    | "leave"
    | "closure"
    | null
  >(null);
  const [showBalanceChart, setShowBalanceChart] = useState(false);
  const [showStats, setShowStats] = useState(true);

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
    const now = new Date();
    const allowedYears = [2026, 2027, 2028, 2029, 2030];
    const safeYear = allowedYears.includes(now.getFullYear())
      ? now.getFullYear()
      : allowedYears[0];
    const startDate =
      safeYear === now.getFullYear() ? now : new Date(safeYear, 0, 1);
    const start = formatLocalDate(startDate);
    setSelectedDate(start);
    setFormDate(start);
    setSelectedYear(safeYear);
  }, []);

  const hasSession = useMemo(() => Boolean(email && userId), [email, userId]);

  const syncUndoState = () => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const pushUndoAction = (action: UndoAction) => {
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > 10) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    syncUndoState();
  };

  const handleUndo = async () => {
    const action = undoStackRef.current.pop();
    if (!action) return;
    await action.undo();
    redoStackRef.current.push(action);
    syncUndoState();
  };

  const handleRedo = async () => {
    const action = redoStackRef.current.pop();
    if (!action) return;
    await action.redo();
    undoStackRef.current.push(action);
    syncUndoState();
  };

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

  const leaveTotals = useMemo(() => {
    const totals = new Map<
      string,
      { hours: number; regular: number; balance: number }
    >();
    for (const entry of leaveEntries) {
      const current = totals.get(entry.leave_date) ?? {
        hours: 0,
        regular: 0,
        balance: 0,
      };
      const regular =
        entry.leave_type === "regular"
          ? current.regular + entry.hours
          : current.regular;
      const balance =
        entry.leave_type === "balance"
          ? current.balance + entry.hours
          : current.balance;
      totals.set(entry.leave_date, {
        hours: Number((current.hours + entry.hours).toFixed(2)),
        regular: Number(regular.toFixed(2)),
        balance: Number(balance.toFixed(2)),
      });
    }
    return totals;
  }, [leaveEntries]);

  const leaveYearTotals = useMemo(() => {
    let regular = 0;
    let balance = 0;
    for (const entry of leaveEntries) {
      if (!entry.leave_date.startsWith(`${selectedYear}-`)) continue;
      if (entry.leave_type === "regular") {
        regular += entry.hours;
      } else {
        balance += entry.hours;
      }
    }
    return {
      regular: Number(regular.toFixed(2)),
      balance: Number(balance.toFixed(2)),
    };
  }, [leaveEntries, selectedYear]);

  const leaveRemaining = useMemo(() => {
    const regularStart = Number(leaveRegularHours);
    const balanceStart = Number(leaveBalanceHours);
    return {
      regular: Number(
        ((Number.isNaN(regularStart) ? 0 : regularStart) -
          leaveYearTotals.regular).toFixed(2)
      ),
      balance: Number(
        ((Number.isNaN(balanceStart) ? 0 : balanceStart) -
          leaveYearTotals.balance).toFixed(2)
      ),
    };
  }, [leaveBalanceHours, leaveRegularHours, leaveYearTotals]);

  const months = useMemo<MonthMeta[]>(() => {
    const list: MonthMeta[] = [];
    for (let i = 0; i < 12; i += 1) {
      const date = new Date(selectedYear, i, 1);
      list.push({ year: date.getFullYear(), monthIndex: date.getMonth() });
    }
    return list;
  }, [selectedYear]);

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

  const vacationMap = useMemo(() => {
    if (!calendarRange) {
      return new Map<string, Array<{ name: string; kind: "region" | "personal" }>>();
    }
    const map = new Map<
      string,
      Array<{ name: string; kind: "region" | "personal" }>
    >();
    for (const vacation of vacations) {
      const start = new Date(vacation.start_date);
      const end = new Date(vacation.end_date);
      for (
        let cursor = new Date(start);
        cursor <= end;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        if (cursor < calendarRange.start || cursor > calendarRange.end) {
          continue;
        }
        const iso = formatLocalDate(cursor);
        const list = map.get(iso) ?? [];
        list.push({
          name: vacation.name ?? "Vakantie",
          kind: vacation.kind,
        });
        map.set(iso, list);
      }
    }
    return map;
  }, [calendarRange, vacations]);

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
    const contractHoursValue = Number(contractHours);
    const weeklyContract = Number.isNaN(contractHoursValue)
      ? 0
      : contractHoursValue;

    const points: BalancePoint[] = [];
    const carryoverValue = Number(carryoverHours);
    let running = Number.isNaN(carryoverValue) ? 0 : carryoverValue;
    const monthlyContract = Number(
      ((weeklyContract * 52) / 12).toFixed(2)
    );
    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const iso = formatLocalDate(cursor);
      const daysInMonth = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0
      ).getDate();
      const planned =
        weeklyContract > 0
          ? Number((monthlyContract / daysInMonth).toFixed(2))
          : 0;
      const actual =
        (entryTotals.get(iso)?.hours ?? 0) + (leaveTotals.get(iso)?.hours ?? 0);
      running = Number((running + (actual - planned)).toFixed(2));
      points.push({ iso, planned, actual, cumulative: running });
    }

    return points;
  }, [entryTotals, closureMap, contractHours, carryoverHours, selectedYear]);

  const todayBalance = useMemo(() => {
    const targetIso = selectedDate ?? formatLocalDate(new Date());
    const point = balanceSeries.find((item) => item.iso === targetIso);
    return point?.cumulative ?? 0;
  }, [balanceSeries, selectedDate]);

  const yearEndBalance = useMemo(() => {
    if (balanceSeries.length === 0) return 0;
    return balanceSeries[balanceSeries.length - 1].cumulative;
  }, [balanceSeries]);

  const ytdTotals = useMemo(() => {
    const cutoffIso = `${selectedYear}-12-31`;
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
  }, [balanceSeries, selectedYear]);

  const monthDeltaMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const point of balanceSeries) {
      if (!point.iso.startsWith(`${selectedYear}-`)) continue;
      const key = point.iso.slice(0, 7);
      const current = map.get(key) ?? 0;
      map.set(key, Number((current + (point.actual - point.planned)).toFixed(2)));
    }
    return map;
  }, [balanceSeries, selectedYear]);

  const monthlyBalancePoints = useMemo(() => {
    const map = new Map<string, number>();
    for (const point of balanceSeries) {
      const key = point.iso.slice(0, 7);
      map.set(key, point.cumulative);
    }
    const points = Array.from({ length: 12 }, (_, index) => {
      const key = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
      return {
        key,
        label: new Date(selectedYear, index, 1).toLocaleDateString("nl-NL", {
          month: "short",
        }),
        value: map.get(key) ?? 0,
      };
    });
    return points;
  }, [balanceSeries, selectedYear]);

  const plannedByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const point of balanceSeries) {
      map.set(point.iso, point.planned);
    }
    return map;
  }, [balanceSeries]);

  const selectedEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entries.filter((entry) => entry.work_date === selectedDate);
  }, [entries, selectedDate]);

  const selectedLeaveEntries = useMemo(() => {
    if (!selectedDate) return [];
    return leaveEntries.filter((entry) => entry.leave_date === selectedDate);
  }, [leaveEntries, selectedDate]);

  const selectedLeaveHours = useMemo(() => {
    return selectedLeaveEntries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [selectedLeaveEntries]);

  const filteredEntryIds = useMemo(() => {
    return filteredEntries.map((entry) => entry.id);
  }, [filteredEntries]);

  const selectedEntryIdSet = useMemo(() => {
    return new Set(selectedEntryIds);
  }, [selectedEntryIds]);

  const allEntriesSelected = useMemo(() => {
    if (filteredEntryIds.length === 0) return false;
    return filteredEntryIds.every((id) => selectedEntryIdSet.has(id));
  }, [filteredEntryIds, selectedEntryIdSet]);

  const selectedHoliday = useMemo(() => {
    if (!selectedDate) return null;
    return holidayMap.get(selectedDate) ?? null;
  }, [holidayMap, selectedDate]);

  const selectedVacations = useMemo(() => {
    if (!selectedDate) return [];
    return vacationMap.get(selectedDate) ?? [];
  }, [vacationMap, selectedDate]);

  const selectedClosures = useMemo(() => {
    if (!selectedDate) return [];
    return closureMap.get(selectedDate) ?? [];
  }, [closureMap, selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    setLeaveDate(selectedDate);
    const planned = plannedByDate.get(selectedDate);
    if (planned !== undefined) {
      setLeaveHours(String(planned));
    }
  }, [plannedByDate, selectedDate]);

  useEffect(() => {
    setSelectedEntryIds((current) =>
      current.filter((id) => filteredEntryIds.includes(id))
    );
  }, [filteredEntryIds]);

  function handleSelectDate(iso: string) {
    setSelectedDate(iso);
    setFormDate(iso);
    setEditingEntryId(null);
  }

  function handleToggleEntrySelection(id: string) {
    setSelectedEntryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function handleSelectAllEntries(checked: boolean) {
    setSelectedEntryIds(checked ? filteredEntryIds : []);
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

  function formatHoursDelta(value: number) {
    const rounded = Number(value.toFixed(2));
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded}u`;
  }

  async function loadEntries(activeUserId: string) {
    setEntriesLoading(true);
    setEntriesError(null);
    const { data, error } = await supabase
      .from("work_entries")
      .select("id, work_date, hours, status, shift_type, notes")
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
      loadProfile(userId);
      loadYearSettings(userId, selectedYear);
      loadClosures(userId);
      loadVacations(userId);
      loadLeaveEntries(userId);
      loadLeaveBalances(userId, selectedYear);
    } else {
      setEntries([]);
      setContractHours("20");
      setCarryoverHours("0");
      setClosures([]);
      setVacations([]);
      setLeaveEntries([]);
      setLeaveRegularHours("0");
      setLeaveBalanceHours("0");
      undoStackRef.current = [];
      redoStackRef.current = [];
      syncUndoState();
    }
  }, [userId, selectedYear]);


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
      contractHoursRef.current = "20";
    } else if (!data) {
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: activeUserId,
        contract_hours_week: 20,
      });
      if (upsertError) {
        setProfileError(upsertError.message);
      }
      setContractHours("20");
      contractHoursRef.current = "20";
    } else {
      const value = (data as ProfileSettings).contract_hours_week ?? 20;
      setContractHours(String(value));
      contractHoursRef.current = String(value);
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
      carryoverRef.current = "0";
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
      carryoverRef.current = "0";
    } else {
      const value = (data as YearSettings).carryover_hours ?? 0;
      setCarryoverHours(String(value));
      carryoverRef.current = String(value);
    }
    setCarryoverLoading(false);
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

  async function loadVacations(activeUserId: string) {
    setVacationsLoading(true);
    setVacationsError(null);
    const { data, error } = await supabase
      .from("vacations")
      .select("id, start_date, end_date, name, kind")
      .eq("user_id", activeUserId)
      .order("start_date", { ascending: true });
    if (error) {
      setVacationsError(error.message);
      setVacations([]);
    } else {
      setVacations((data as Vacation[]) ?? []);
    }
    setVacationsLoading(false);
  }

  async function loadLeaveEntries(activeUserId: string) {
    setLeaveLoading(true);
    setLeaveError(null);
    const { data, error } = await supabase
      .from("leave_entries")
      .select("id, leave_date, hours, leave_type, notes")
      .eq("user_id", activeUserId)
      .order("leave_date", { ascending: true });
    if (error) {
      setLeaveError(error.message);
      setLeaveEntries([]);
    } else {
      setLeaveEntries((data as LeaveEntry[]) ?? []);
    }
    setLeaveLoading(false);
  }

  async function loadLeaveBalances(activeUserId: string, year: number) {
    setLeaveBalancesLoading(true);
    setLeaveBalancesError(null);
    const { data, error } = await supabase
      .from("leave_balances")
      .select("year, regular_hours, balance_hours")
      .eq("user_id", activeUserId)
      .eq("year", year)
      .maybeSingle();
    if (error) {
      setLeaveBalancesError(error.message);
      setLeaveRegularHours("0");
      setLeaveBalanceHours("0");
      leaveRegularRef.current = "0";
      leaveBalanceRef.current = "0";
    } else if (!data) {
      const { error: upsertError } = await supabase
        .from("leave_balances")
        .upsert(
          {
            user_id: activeUserId,
            year,
            regular_hours: 0,
            balance_hours: 0,
          },
          { onConflict: "user_id,year" }
        );
      if (upsertError) {
        setLeaveBalancesError(upsertError.message);
      }
      setLeaveRegularHours("0");
      setLeaveBalanceHours("0");
      leaveRegularRef.current = "0";
      leaveBalanceRef.current = "0";
    } else {
      const values = data as LeaveBalances;
      setLeaveRegularHours(String(values.regular_hours ?? 0));
      setLeaveBalanceHours(String(values.balance_hours ?? 0));
      leaveRegularRef.current = String(values.regular_hours ?? 0);
      leaveBalanceRef.current = String(values.balance_hours ?? 0);
    }
    setLeaveBalancesLoading(false);
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
      shift_type: formShiftType,
      notes: formNotes.trim() ? formNotes.trim() : null,
    };
    if (editingEntryId) {
      const previousEntry = entries.find((entry) => entry.id === editingEntryId);
      const { error } = await supabase
        .from("work_entries")
        .update(payload)
        .eq("id", editingEntryId);
      if (error) {
        setEntriesError(error.message);
      } else {
        if (previousEntry) {
          const previousPayload = {
            work_date: previousEntry.work_date,
            hours: previousEntry.hours,
            status: previousEntry.status,
            shift_type: previousEntry.shift_type,
            notes: previousEntry.notes,
          };
          const nextPayload = {
            work_date: payload.work_date,
            hours: payload.hours,
            status: payload.status,
            shift_type: payload.shift_type,
            notes: payload.notes,
          };
          pushUndoAction({
            label: "Werkuren bijgewerkt",
            undo: async () => {
              await supabase
                .from("work_entries")
                .update(previousPayload)
                .eq("id", previousEntry.id);
              await loadEntries(userId);
            },
            redo: async () => {
              await supabase
                .from("work_entries")
                .update(nextPayload)
                .eq("id", previousEntry.id);
              await loadEntries(userId);
            },
          });
        }
        setFormNotes("");
        setEditingEntryId(null);
        await loadEntries(userId);
      }
    } else {
      const { data, error } = await supabase
        .from("work_entries")
        .insert(payload)
        .select("id, work_date, hours, status, shift_type, notes")
        .single();
      if (error) {
        setEntriesError(error.message);
      } else {
        const inserted = data as WorkEntry;
        pushUndoAction({
          label: "Werkuren toegevoegd",
          undo: async () => {
            await supabase.from("work_entries").delete().eq("id", inserted.id);
            await loadEntries(userId);
          },
          redo: async () => {
            await supabase
              .from("work_entries")
              .insert({ ...inserted, user_id: userId });
            await loadEntries(userId);
          },
        });
        setFormNotes("");
        setEditingEntryId(null);
        await loadEntries(userId);
      }
    }
    setFormBusy(false);
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
    const previousValue = Number(contractHoursRef.current);
    setProfileBusy(true);
    setProfileError(null);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      contract_hours_week: value,
    });
    if (error) {
      setProfileError(error.message);
    } else {
      pushUndoAction({
        label: "Contracturen aangepast",
        undo: async () => {
          await supabase.from("profiles").upsert({
            id: userId,
            contract_hours_week: previousValue,
          });
          await loadProfile(userId);
        },
        redo: async () => {
          await supabase.from("profiles").upsert({
            id: userId,
            contract_hours_week: value,
          });
          await loadProfile(userId);
        },
      });
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
    const previousValue = Number(carryoverRef.current);
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
      pushUndoAction({
        label: "Startsaldo aangepast",
        undo: async () => {
          await supabase.from("year_settings").upsert(
            {
              user_id: userId,
              year: selectedYear,
              carryover_hours: previousValue,
            },
            { onConflict: "user_id,year" }
          );
          await loadYearSettings(userId, selectedYear);
        },
        redo: async () => {
          await supabase.from("year_settings").upsert(
            {
              user_id: userId,
              year: selectedYear,
              carryover_hours: value,
            },
            { onConflict: "user_id,year" }
          );
          await loadYearSettings(userId, selectedYear);
        },
      });
      await loadYearSettings(userId, selectedYear);
    }
    setCarryoverBusy(false);
  }

  async function handleDeleteEntry(entryId: string) {
    if (!userId) return;
    setEntriesError(null);
    const entry = entries.find((item) => item.id === entryId);
    const { error } = await supabase
      .from("work_entries")
      .delete()
      .eq("id", entryId);
    if (error) {
      setEntriesError(error.message);
    } else {
      if (entry) {
        pushUndoAction({
          label: "Werkuren verwijderd",
          undo: async () => {
            await supabase
              .from("work_entries")
              .insert({ ...entry, user_id: userId });
            await loadEntries(userId);
          },
          redo: async () => {
            await supabase.from("work_entries").delete().eq("id", entryId);
            await loadEntries(userId);
          },
        });
      }
      await loadEntries(userId);
    }
  }

  async function handleDeleteSelectedEntries() {
    if (!userId || selectedEntryIds.length === 0) return;
    setEntriesError(null);
    const entriesToDelete = filteredEntries.filter((entry) =>
      selectedEntryIdSet.has(entry.id)
    );
    const ids = entriesToDelete.map((entry) => entry.id);
    const { error } = await supabase.from("work_entries").delete().in("id", ids);
    if (error) {
      setEntriesError(error.message);
      return;
    }
    pushUndoAction({
      label: "Meerdere diensten verwijderd",
      undo: async () => {
        await supabase
          .from("work_entries")
          .insert(entriesToDelete.map((entry) => ({ ...entry, user_id: userId })));
        await loadEntries(userId);
      },
      redo: async () => {
        await supabase.from("work_entries").delete().in("id", ids);
        await loadEntries(userId);
      },
    });
    setSelectedEntryIds([]);
    await loadEntries(userId);
  }

  function handleEditEntry(entry: WorkEntry) {
    setEditingEntryId(entry.id);
    setFormDate(entry.work_date);
    setFormHours(String(entry.hours));
    setFormStatus(entry.status);
    setFormShiftType(entry.shift_type ?? "day");
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
    const { data, error } = await supabase
      .from("closures")
      .insert({
        user_id: userId,
        start_date: closureStart,
        end_date: closureEnd,
        reason: closureReason.trim() ? closureReason.trim() : null,
        can_work: closureCanWork,
      })
      .select("id, start_date, end_date, reason, can_work")
      .single();
    if (error) {
      setClosuresError(error.message);
    } else {
      const inserted = data as Closure;
      pushUndoAction({
        label: "Sluiting toegevoegd",
        undo: async () => {
          await supabase.from("closures").delete().eq("id", inserted.id);
          await loadClosures(userId);
        },
        redo: async () => {
          await supabase
            .from("closures")
            .insert({ ...inserted, user_id: userId });
          await loadClosures(userId);
        },
      });
      setClosureReason("");
      setClosureCanWork(false);
      await loadClosures(userId);
    }
    setClosureBusy(false);
  }

  async function handleDeleteClosure(closureId: string) {
    if (!userId) return;
    setClosuresError(null);
    const closure = closures.find((item) => item.id === closureId);
    const { error } = await supabase
      .from("closures")
      .delete()
      .eq("id", closureId);
    if (error) {
      setClosuresError(error.message);
    } else {
      if (closure) {
        pushUndoAction({
          label: "Sluiting verwijderd",
          undo: async () => {
            await supabase
              .from("closures")
              .insert({ ...closure, user_id: userId });
            await loadClosures(userId);
          },
          redo: async () => {
            await supabase.from("closures").delete().eq("id", closureId);
            await loadClosures(userId);
          },
        });
      }
      await loadClosures(userId);
    }
  }

  async function handleSaveLeaveBalances(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!userId) {
      setLeaveBalancesError("Je bent niet ingelogd.");
      return;
    }
    const regularValue = Number(leaveRegularHours);
    const balanceValue = Number(leaveBalanceHours);
    if (Number.isNaN(regularValue) || Number.isNaN(balanceValue)) {
      setLeaveBalancesError("Vul geldige verlofsaldo's in.");
      return;
    }
    const previousRegular = Number(leaveRegularRef.current);
    const previousBalance = Number(leaveBalanceRef.current);
    setLeaveBalancesBusy(true);
    setLeaveBalancesError(null);
    const { error } = await supabase.from("leave_balances").upsert(
      {
        user_id: userId,
        year: selectedYear,
        regular_hours: regularValue,
        balance_hours: balanceValue,
      },
      { onConflict: "user_id,year" }
    );
    if (error) {
      setLeaveBalancesError(error.message);
    } else {
      pushUndoAction({
        label: "Verlofsaldo aangepast",
        undo: async () => {
          await supabase.from("leave_balances").upsert(
            {
              user_id: userId,
              year: selectedYear,
              regular_hours: previousRegular,
              balance_hours: previousBalance,
            },
            { onConflict: "user_id,year" }
          );
          await loadLeaveBalances(userId, selectedYear);
        },
        redo: async () => {
          await supabase.from("leave_balances").upsert(
            {
              user_id: userId,
              year: selectedYear,
              regular_hours: regularValue,
              balance_hours: balanceValue,
            },
            { onConflict: "user_id,year" }
          );
          await loadLeaveBalances(userId, selectedYear);
        },
      });
      await loadLeaveBalances(userId, selectedYear);
    }
    setLeaveBalancesBusy(false);
  }

  async function handleAddLeaveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setLeaveError("Je bent niet ingelogd.");
      return;
    }
    const hoursValue = Number(leaveHours);
    if (!leaveDate || Number.isNaN(hoursValue) || hoursValue <= 0) {
      setLeaveError("Vul een datum en geldige uren in.");
      return;
    }
    const deletedEntries = entries.filter(
      (entry) => entry.work_date === leaveDate
    );
    setLeaveBusy(true);
    setLeaveError(null);
    const { data, error } = await supabase
      .from("leave_entries")
      .insert({
        user_id: userId,
        leave_date: leaveDate,
        hours: hoursValue,
        leave_type: leaveType,
        notes: null,
      })
      .select("id, leave_date, hours, leave_type, notes")
      .single();
    if (error) {
      setLeaveError(error.message);
    } else {
      const inserted = data as LeaveEntry;
      const { error: deleteWorkError } = await supabase
        .from("work_entries")
        .delete()
        .eq("user_id", userId)
        .eq("work_date", leaveDate);
      if (deleteWorkError) {
        setLeaveError(
          `Verlof opgeslagen, maar diensten niet verwijderd: ${deleteWorkError.message}`
        );
      }
      pushUndoAction({
        label: "Verlof toegevoegd",
        undo: async () => {
          await supabase.from("leave_entries").delete().eq("id", inserted.id);
          if (deletedEntries.length > 0) {
            await supabase
              .from("work_entries")
              .insert(
                deletedEntries.map((entry) => ({ ...entry, user_id: userId }))
              );
          }
          await loadEntries(userId);
          await loadLeaveEntries(userId);
        },
        redo: async () => {
          await supabase
            .from("leave_entries")
            .insert({ ...inserted, user_id: userId });
          await supabase
            .from("work_entries")
            .delete()
            .eq("user_id", userId)
            .eq("work_date", leaveDate);
          await loadEntries(userId);
          await loadLeaveEntries(userId);
        },
      });
      await loadEntries(userId);
      await loadLeaveEntries(userId);
    }
    setLeaveBusy(false);
  }

  async function handleDeleteLeaveEntry(leaveId: string) {
    if (!userId) return;
    setLeaveError(null);
    const entry = leaveEntries.find((item) => item.id === leaveId);
    const { error } = await supabase
      .from("leave_entries")
      .delete()
      .eq("id", leaveId);
    if (error) {
      setLeaveError(error.message);
    } else {
      if (entry) {
        pushUndoAction({
          label: "Verlof verwijderd",
          undo: async () => {
            await supabase
              .from("leave_entries")
              .insert({ ...entry, user_id: userId });
            await loadLeaveEntries(userId);
          },
          redo: async () => {
            await supabase.from("leave_entries").delete().eq("id", leaveId);
            await loadLeaveEntries(userId);
          },
        });
      }
      await loadLeaveEntries(userId);
    }
  }

  async function handleAddVacation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setVacationsError("Je bent niet ingelogd.");
      return;
    }
    if (!vacationStart || !vacationEnd) {
      setVacationsError("Vul een start- en einddatum in.");
      return;
    }
    setVacationBusy(true);
    setVacationsError(null);
    const { data, error } = await supabase
      .from("vacations")
      .insert({
        user_id: userId,
        start_date: vacationStart,
        end_date: vacationEnd,
        name: vacationName.trim() ? vacationName.trim() : null,
        kind: vacationKind,
      })
      .select("id, start_date, end_date, name, kind")
      .single();
    if (error) {
      setVacationsError(error.message);
    } else {
      const inserted = data as Vacation;
      pushUndoAction({
        label: "Vakantie toegevoegd",
        undo: async () => {
          await supabase.from("vacations").delete().eq("id", inserted.id);
          await loadVacations(userId);
        },
        redo: async () => {
          await supabase
            .from("vacations")
            .insert({ ...inserted, user_id: userId });
          await loadVacations(userId);
        },
      });
      setVacationName("");
      await loadVacations(userId);
    }
    setVacationBusy(false);
  }

  async function handleDeleteVacation(vacationId: string) {
    if (!userId) return;
    setVacationsError(null);
    const vacation = vacations.find((item) => item.id === vacationId);
    const { error } = await supabase
      .from("vacations")
      .delete()
      .eq("id", vacationId);
    if (error) {
      setVacationsError(error.message);
    } else {
      if (vacation) {
        pushUndoAction({
          label: "Vakantie verwijderd",
          undo: async () => {
            await supabase
              .from("vacations")
              .insert({ ...vacation, user_id: userId });
            await loadVacations(userId);
          },
          redo: async () => {
            await supabase.from("vacations").delete().eq("id", vacationId);
            await loadVacations(userId);
          },
        });
      }
      await loadVacations(userId);
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Dashboard
            </p>
            <h1 className="text-xl font-semibold">Jaarplanner</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
              onClick={handleUndo}
              disabled={!canUndo}
            >
              Undo
            </button>
            <button
              type="button"
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
              onClick={handleRedo}
              disabled={!canRedo}
            >
              Redo
            </button>
            <a
              href="/login"
              className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              Account
            </a>
          </div>
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
            <div className="sticky top-0 z-10 -mx-3 border-b border-zinc-200 bg-white/95 px-3 pb-2 pt-2 backdrop-blur md:rounded-t-2xl md:pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold md:text-base">
                    Jaaroverzicht
                  </h2>
                  <p className="mt-1 text-xs text-zinc-600 md:text-sm">
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
                      }}
                    >
                      {[2026, 2027, 2028, 2029, 2030].map((yearOption) => (
                        <option key={yearOption} value={yearOption}>
                          {yearOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                  onClick={() => setShowStats((current) => !current)}
                  aria-expanded={showStats}
                >
                  {showStats ? "Verberg statistieken" : "Toon statistieken"}
                </button>
              </div>
              {showStats ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white px-2 py-2 md:px-3">
                      <p className="text-xs font-semibold uppercase text-zinc-400">
                        Cumulatief t/m geselecteerde datum
                      </p>
                      <p className="mt-2 text-lg font-semibold text-zinc-900 md:text-xl">
                        {todayBalance}u
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white px-2 py-2 md:px-3">
                      <p className="text-xs font-semibold uppercase text-zinc-400">
                        Prognose einde jaar
                      </p>
                      <p className="mt-2 text-lg font-semibold text-zinc-900 md:text-xl">
                        {yearEndBalance}u
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-zinc-400">
                        Werkelijk (jaar t/m 31-12)
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900">
                        {ytdTotals.actual}u
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-zinc-400">
                        Contract (jaar t/m 31-12)
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900">
                        {ytdTotals.planned}u
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-zinc-400">
                        Verschil (jaar t/m 31-12)
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900">
                        {ytdTotals.delta}u
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase text-zinc-400"
                      onClick={() => setShowBalanceChart((current) => !current)}
                      aria-expanded={showBalanceChart}
                    >
                      <span>Cumulatief saldo per maand</span>
                      <span className="text-[11px] text-zinc-500">
                        {showBalanceChart ? "Verberg" : "Toon"}
                      </span>
                    </button>
                    {showBalanceChart ? (
                      <div className="mt-3 h-40 w-full">
                        {(() => {
                          const width = 600;
                          const height = 160;
                          const padX = 24;
                          const padY = 18;
                          const values = monthlyBalancePoints.map((point) => point.value);
                          const min = Math.min(0, ...values);
                          const max = Math.max(0, ...values);
                          const range = max - min || 1;
                          const xStep =
                            monthlyBalancePoints.length > 1
                              ? (width - padX * 2) /
                                (monthlyBalancePoints.length - 1)
                              : 0;
                          const yScale = (height - padY * 2) / range;
                          const points = monthlyBalancePoints.map(
                            (point, index) => {
                              const x = padX + index * xStep;
                              const y = padY + (max - point.value) * yScale;
                              return { x, y, value: point.value, label: point.label };
                            }
                          );
                          const line = points
                            .map((point) => `${point.x},${point.y}`)
                            .join(" ");
                          const zeroY = padY + (max - 0) * yScale;
                          return (
                            <svg
                              viewBox={`0 0 ${width} ${height}`}
                              className="h-full w-full"
                            >
                              <line
                                x1={padX}
                                x2={width - padX}
                                y1={zeroY}
                                y2={zeroY}
                                stroke="#94a3b8"
                                strokeWidth="1.5"
                              />
                              <polyline
                                fill="none"
                                stroke="#c04a7a"
                                strokeWidth="2"
                                points={line}
                              />
                              {points.map((point) => (
                                <circle
                                  key={point.x}
                                  cx={point.x}
                                  cy={point.y}
                                  r="2.5"
                                  fill="#e46a99"
                                >
                                  <title>{`${point.label}: ${point.value.toFixed(
                                    2
                                  )}u`}</title>
                                </circle>
                              ))}
                              {points.map((point) => (
                                <text
                                  key={`${point.x}-label`}
                                  x={point.x}
                                  y={height - 4}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#94a3b8"
                                >
                                  {point.label}
                                </text>
                              ))}
                            </svg>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
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
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    legendFocus === "holiday"
                      ? "border-rose-500 bg-rose-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                  onClick={() =>
                    setLegendFocus((current) =>
                      current === "holiday" ? null : "holiday"
                    )
                  }
                  aria-pressed={legendFocus === "holiday"}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-700" />
                  Feestdag
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    legendFocus === "vacation_region"
                      ? "border-rose-500 bg-rose-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                  onClick={() =>
                    setLegendFocus((current) =>
                      current === "vacation_region" ? null : "vacation_region"
                    )
                  }
                  aria-pressed={legendFocus === "vacation_region"}
                >
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  Vakantie (Noord)
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    legendFocus === "vacation_personal"
                      ? "border-rose-500 bg-rose-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                  onClick={() =>
                    setLegendFocus((current) =>
                      current === "vacation_personal"
                        ? null
                        : "vacation_personal"
                    )
                  }
                  aria-pressed={legendFocus === "vacation_personal"}
                >
                  <span className="h-2 w-2 rounded-full bg-teal-400" />
                  Eigen vakantie
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    legendFocus === "leave"
                      ? "border-rose-500 bg-rose-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                  onClick={() =>
                    setLegendFocus((current) =>
                      current === "leave" ? null : "leave"
                    )
                  }
                  aria-pressed={legendFocus === "leave"}
                >
                  <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  Verlof
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    legendFocus === "closure"
                      ? "border-rose-500 bg-rose-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                  onClick={() =>
                    setLegendFocus((current) =>
                      current === "closure" ? null : "closure"
                    )
                  }
                  aria-pressed={legendFocus === "closure"}
                >
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  Gesloten
                </button>
                {legendFocus ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                    onClick={() => setLegendFocus(null)}
                  >
                    Reset focus
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {months.map((month) => {
                const cells = buildMonthCells(month);
                const monthKey = `${month.year}-${String(month.monthIndex + 1).padStart(2, "0")}`;
                const monthDelta = monthDeltaMap.get(monthKey) ?? 0;
                return (
                  <div
                    key={`${month.year}-${month.monthIndex}`}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold capitalize text-zinc-700">
                        {monthLabel(month)}
                      </p>
                      <span
                        className={`text-xs font-semibold ${
                          monthDelta < 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {formatHoursDelta(monthDelta)}
                      </span>
                    </div>
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
                        const leaveForDay = leaveTotals.get(cell.iso);
                        const leaveHoursForDay = leaveForDay?.hours ?? 0;
                        const totalHours = Number(
                          (hours + leaveHoursForDay).toFixed(2)
                        );
                        const holiday = holidayMap.get(cell.iso);
                        const vacationsForDay = vacationMap.get(cell.iso) ?? [];
                        const hasPersonalVacation = vacationsForDay.some(
                          (vacation) => vacation.kind === "personal"
                        );
                        const hasRegionVacation = vacationsForDay.some(
                          (vacation) => vacation.kind === "region"
                        );
                        const closuresForDay = closureMap.get(cell.iso) ?? [];
                        const matchesFocus = legendFocus
                          ? legendFocus === "holiday"
                            ? Boolean(holiday)
                            : legendFocus === "vacation_region"
                            ? hasRegionVacation
                            : legendFocus === "vacation_personal"
                            ? hasPersonalVacation
                            : legendFocus === "leave"
                            ? leaveHoursForDay > 0
                            : closuresForDay.length > 0
                          : true;
                        const tone = leaveHoursForDay > 0
                          ? "bg-indigo-100 text-indigo-900"
                          : hasFinal
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
                            className={`relative flex h-10 flex-col items-center justify-center rounded-lg border px-1 pr-4 ${tone} ${
                              cell.inMonth ? "" : "opacity-40"
                            } ${matchesFocus ? "" : "opacity-40"} ${
                              isSelected ? "border-rose-500" : "border-zinc-200"
                            }`}
                          >
                            {holiday ||
                            vacationsForDay.length > 0 ||
                            closuresForDay.length > 0 ? (
                              <span className="absolute right-1 top-1 flex flex-col items-center gap-1">
                                {holiday ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-700" />
                                ) : null}
                                {hasRegionVacation ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                                ) : null}
                                {hasPersonalVacation ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                                ) : null}
                                {closuresForDay.length > 0 ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                                ) : null}
                              </span>
                            ) : null}
                            <span className="text-sm font-semibold">
                              {cell.date.getDate()}
                            </span>
                            {totalHours > 0 ? (
                              <span className="inline-flex items-center justify-center gap-0.5 pl-1.5 text-[10px] font-semibold leading-none">
                                {totalHours}u
                                {leaveHoursForDay > 0 ? (
                                  <span className="relative -top-px rounded bg-indigo-200 px-1 text-[9px] font-semibold text-indigo-800 leading-none">
                                    V
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">-</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
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
                    {selectedVacations.length > 0 ? (
                      <div className="mt-1 space-y-1 text-xs">
                        {selectedVacations.some(
                          (vacation) => vacation.kind === "region"
                        ) ? (
                          <p className="text-orange-700">
                            Vakantie (Noord):{" "}
                            {selectedVacations
                              .filter((vacation) => vacation.kind === "region")
                              .map((vacation) => vacation.name)
                              .join(", ")}
                          </p>
                        ) : null}
                        {selectedVacations.some(
                          (vacation) => vacation.kind === "personal"
                        ) ? (
                          <p className="text-teal-700">
                            Eigen vakantie:{" "}
                            {selectedVacations
                              .filter((vacation) => vacation.kind === "personal")
                              .map((vacation) => vacation.name)
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedClosures.length > 0 ? (
                      <div className="mt-1 text-xs text-purple-700">
                        <p>Bedrijf gesloten</p>
                        {selectedClosures.map((closure) => (
                          <p key={closure.id} className="text-purple-600">
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
                            {entry.shift_type ? (
                              <p className="text-xs text-zinc-500">
                                {entry.shift_type === "day"
                                  ? "Dagdienst"
                                  : entry.shift_type === "evening"
                                  ? "Avonddienst"
                                  : entry.shift_type === "night"
                                  ? "Nachtdienst"
                                  : "KTO"}
                              </p>
                            ) : null}
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
                    {selectedLeaveEntries.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold uppercase text-zinc-400">
                          Verlof
                        </p>
                        {selectedLeaveEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-zinc-800">
                                {entry.hours}u -{" "}
                                {entry.leave_type === "regular"
                                  ? "Gewoon verlof"
                                  : "Balans verlof"}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300"
                              onClick={() => handleDeleteLeaveEntry(entry.id)}
                            >
                              Verwijder
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Geen dag geselecteerd.
                </p>
              )}
            </div>
            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Nieuwe uren
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Voeg een concept of definitieve dienst toe.
                </span>
              </summary>
              {editingEntryId ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  Bewerken: je past een bestaande dienst aan.
                </p>
              ) : null}
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleAddEntry}
              >
                {selectedLeaveHours > 0 ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Let op: er staat {selectedLeaveHours}u verlof op deze datum.
                    Nieuwe uren overschrijven mogelijk je verlof.
                  </p>
                ) : null}
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
                  Diensttype
                  <select
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={formShiftType}
                    onChange={(event) =>
                      setFormShiftType(
                        event.target.value as "day" | "evening" | "night" | "kto"
                      )
                    }
                  >
                    <option value="day">Dagdienst</option>
                    <option value="evening">Avonddienst</option>
                    <option value="night">Nachtdienst</option>
                    <option value="kto">KTO</option>
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
                    className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
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
            </details>
            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Verlof opnemen
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Registreer verlof op de geselecteerde datum.
                </span>
              </summary>
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleAddLeaveEntry}
              >
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Datum (geselecteerd)
                  <input
                    type="date"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={leaveDate}
                    onChange={(event) => setLeaveDate(event.target.value)}
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
                    value={leaveHours}
                    onChange={(event) => setLeaveHours(event.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Verlofsoort
                  <select
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={leaveType}
                    onChange={(event) =>
                      setLeaveType(event.target.value as "regular" | "balance")
                    }
                  >
                    <option value="regular">Gewoon verlof</option>
                    <option value="balance">Balans verlof</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                  disabled={leaveBusy || !hasSession}
                >
                  {leaveBusy ? "Opslaan..." : "Verlof toevoegen"}
                </button>
                {!hasSession ? (
                  <p className="text-xs text-zinc-500">
                    Log in om verlof op te slaan.
                  </p>
                ) : null}
                {leaveError ? (
                  <p className="text-xs text-rose-600">{leaveError}</p>
                ) : null}
              </form>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                {leaveLoading ? (
                  <p>Verlof laden...</p>
                ) : leaveEntries.length === 0 ? (
                  <p>Nog geen verlof ingevoerd.</p>
                ) : (
                  leaveEntries
                    .filter((entry) =>
                      entry.leave_date.startsWith(`${selectedYear}-`)
                    )
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold text-zinc-800">
                            {entry.leave_date} - {entry.hours}u
                          </p>
                          <p className="text-xs text-zinc-500">
                            {entry.leave_type === "regular"
                              ? "Gewoon verlof"
                              : "Balans verlof"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-300"
                          onClick={() => handleDeleteLeaveEntry(entry.id)}
                        >
                          Verwijder
                        </button>
                      </div>
                    ))
                )}
              </div>
            </details>
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
                  className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
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
                Verlofsaldo
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Saldo per 1 januari voor {selectedYear}.
                </span>
              </summary>
              <form
                className="mt-3 flex flex-col gap-3"
                onSubmit={handleSaveLeaveBalances}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Gewoon verlof (uren)
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={leaveRegularHours}
                      onChange={(event) =>
                        setLeaveRegularHours(event.target.value)
                      }
                      disabled={leaveBalancesLoading}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Balans verlof (uren)
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={leaveBalanceHours}
                      onChange={(event) =>
                        setLeaveBalanceHours(event.target.value)
                      }
                      disabled={leaveBalancesLoading}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                  disabled={leaveBalancesBusy || !hasSession}
                >
                  {leaveBalancesBusy ? "Opslaan..." : "Opslaan"}
                </button>
                {leaveBalancesError ? (
                  <p className="text-xs text-rose-600">{leaveBalancesError}</p>
                ) : null}
                {!hasSession ? (
                  <p className="text-xs text-zinc-500">
                    Log in om verlofsaldo op te slaan.
                  </p>
                ) : null}
              </form>
              <div className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-zinc-400">
                    Opgenomen (gewoon)
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">
                    {leaveYearTotals.regular}u
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Resterend: {leaveRemaining.regular}u
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-zinc-400">
                    Opgenomen (balans)
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">
                    {leaveYearTotals.balance}u
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Resterend: {leaveRemaining.balance}u
                  </p>
                </div>
              </div>
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
                  className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
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
                Vakanties
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Regio Noord en eigen vakanties invoeren.
                </span>
              </summary>
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleAddVacation}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                    Startdatum
                    <input
                      type="date"
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={vacationStart}
                      onChange={(event) => setVacationStart(event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                    Einddatum
                    <input
                      type="date"
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                      value={vacationEnd}
                      onChange={(event) => setVacationEnd(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Type
                  <select
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={vacationKind}
                    onChange={(event) =>
                      setVacationKind(event.target.value as "region" | "personal")
                    }
                  >
                    <option value="region">Vakantie (Noord)</option>
                    <option value="personal">Eigen vakantie</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Naam (optioneel)
                  <input
                    type="text"
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-400 focus:outline-none"
                    value={vacationName}
                    onChange={(event) => setVacationName(event.target.value)}
                    placeholder="Bijv. Meivakantie"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                  disabled={vacationBusy || !hasSession}
                >
                  {vacationBusy ? "Opslaan..." : "Vakantie opslaan"}
                </button>
                {!hasSession ? (
                  <p className="text-xs text-zinc-500">
                    Log in om vakanties op te slaan.
                  </p>
                ) : null}
                {vacationsError ? (
                  <p className="text-xs text-rose-600">{vacationsError}</p>
                ) : null}
              </form>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                {vacationsLoading ? (
                  <p>Vakanties laden...</p>
                ) : vacations.length === 0 ? (
                  <p>Nog geen vakanties ingesteld.</p>
                ) : (
                  vacations.map((vacation) => (
                    <div
                      key={vacation.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-zinc-800">
                          {vacation.start_date} t/m {vacation.end_date}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {vacation.name ? vacation.name : "Vakantie"} -{" "}
                          {vacation.kind === "region"
                            ? "Regio Noord"
                            : "Eigen"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-300"
                        onClick={() => handleDeleteVacation(vacation.id)}
                      >
                        Verwijder
                      </button>
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
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
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
            <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
                Jouw diensten
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Concept en definitieve uren voor dit jaar.
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-zinc-500">
                    Geselecteerd: {selectedEntryIds.length}
                  </span>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:opacity-50"
                    onClick={handleDeleteSelectedEntries}
                    disabled={selectedEntryIds.length === 0}
                  >
                    Verwijder geselecteerd
                  </button>
                </div>
                {entriesLoading ? (
                  <p className="text-sm text-zinc-600">Laden...</p>
                ) : entriesError ? (
                  <p className="text-sm text-rose-600">{entriesError}</p>
                ) : filteredEntries.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Nog geen diensten toegevoegd.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="text-[11px] uppercase text-zinc-400">
                        <tr>
                          <th className="w-8 py-2">
                            <input
                              type="checkbox"
                              checked={allEntriesSelected}
                              onChange={(event) =>
                                handleSelectAllEntries(event.target.checked)
                              }
                            />
                          </th>
                          <th className="py-2">Datum</th>
                          <th className="py-2">Uren</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Dienst</th>
                          <th className="py-2">Opmerking</th>
                          <th className="py-2 text-right">Acties</th>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-700">
                        {filteredEntries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-t border-zinc-100"
                          >
                            <td className="py-2">
                              <input
                                type="checkbox"
                                checked={selectedEntryIdSet.has(entry.id)}
                                onChange={() =>
                                  handleToggleEntrySelection(entry.id)
                                }
                              />
                            </td>
                            <td className="py-2 font-semibold">
                              {entry.work_date}
                            </td>
                            <td className="py-2">{entry.hours}u</td>
                            <td className="py-2">
                              {entry.status === "final"
                                ? "Definitief"
                                : "Concept"}
                            </td>
                            <td className="py-2">
                              {entry.shift_type
                                ? entry.shift_type === "day"
                                  ? "Dagdienst"
                                  : entry.shift_type === "evening"
                                  ? "Avonddienst"
                                  : entry.shift_type === "night"
                                  ? "Nachtdienst"
                                  : "KTO"
                                : "-"}
                            </td>
                            <td className="py-2 text-zinc-500">
                              {entry.notes ? entry.notes : "-"}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}
