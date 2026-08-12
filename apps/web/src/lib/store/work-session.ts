"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/utils";

export type Workday = {
  id: string;
  work_date: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  target_minutes: number;
  actual_minutes: number;
} | null;

export type TodayTask = {
  id: string;
  title: string;
  completed: boolean;
  status: string;
  is_revenue_producing: boolean;
};

export type WorkStatus =
  | "not_clocked_in"
  | "working"
  | "on_break"
  | "in_field"
  | "in_meeting"
  | "day_complete";

type WorkSessionState = {
  initialized: boolean;
  loading: boolean;
  workday: Workday;
  nonNegotiables: TodayTask[];
  selectedTaskId: string | null;
  activeEntryId: string | null;
  activeEntryStartedAt: string | null;
  activeEntryCategory: "work" | "break" | null;
  breakMinutesBase: number;
  manualStatus: WorkStatus | null;
  bigSteinReviewing: boolean;

  init: () => Promise<void>;
  refreshWorkday: () => Promise<void>;
  refreshNonNegotiables: () => Promise<void>;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  setManualStatus: (status: WorkStatus | null) => void;
  selectTask: (taskId: string | null) => void;
  startTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  setBigSteinReviewing: (value: boolean) => void;
  status: () => WorkStatus;
  /** @internal shared by pauseTimer/stopTimer — not for direct use */
  _endActiveEntry: () => Promise<void>;
};

let listenerAttached = false;

export const useWorkSession = create<WorkSessionState>((set, get) => ({
  initialized: false,
  loading: false,
  workday: null,
  nonNegotiables: [],
  selectedTaskId: null,
  activeEntryId: null,
  activeEntryStartedAt: null,
  activeEntryCategory: null,
  breakMinutesBase: 0,
  manualStatus: null,
  bigSteinReviewing: false,

  async init() {
    if (get().initialized) return;
    set({ loading: true });
    await Promise.all([get().refreshWorkday(), get().refreshNonNegotiables()]);
    set({ initialized: true, loading: false });

    if (!listenerAttached && typeof window !== "undefined") {
      listenerAttached = true;
      window.addEventListener("oaos:tasks-changed", () => {
        get().refreshNonNegotiables();
      });
      window.addEventListener("oaos:workday-changed", () => {
        get().refreshWorkday();
      });
    }
  },

  async refreshWorkday() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = todayISO();
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = `${today}T23:59:59.999Z`;

    // Both queries are independent (time_entries is filtered by the day's
    // timestamp range, not by workday_id) so they run in parallel instead
    // of the workday lookup blocking the entries lookup.
    const [{ data: workday }, { data: entries }] = await Promise.all([
      supabase
        .from("workdays")
        .select("id, work_date, clocked_in_at, clocked_out_at, target_minutes, actual_minutes")
        .eq("user_id", user.id)
        .eq("work_date", today)
        .maybeSingle(),

      supabase
        .from("time_entries")
        .select("id, started_at, ended_at, task_id, category, duration_minutes")
        .eq("user_id", user.id)
        .gte("started_at", dayStart)
        .lte("started_at", dayEnd)
        .order("started_at", { ascending: false }),
    ]);

    const active = (entries ?? []).find((e) => !e.ended_at) ?? null;
    const breakMinutesBase = (entries ?? [])
      .filter((e) => e.category === "break" && e.ended_at)
      .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

    set({
      workday: workday ?? null,
      activeEntryId: active?.id ?? null,
      activeEntryStartedAt: active?.started_at ?? null,
      activeEntryCategory: active ? (active.category === "break" ? "break" : "work") : null,
      breakMinutesBase,
      selectedTaskId: active?.task_id ?? get().selectedTaskId,
    });
  },

  async refreshNonNegotiables() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("tasks")
      .select("id, title, completed, status, is_revenue_producing")
      .eq("user_id", user.id)
      .eq("is_non_negotiable", true)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    set({ nonNegotiables: data ?? [] });
  },

  async clockIn() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("workdays")
      .upsert(
        {
          user_id: user.id,
          work_date: todayISO(),
          clocked_in_at: new Date().toISOString(),
          clocked_out_at: null,
        },
        { onConflict: "user_id,work_date" }
      )
      .select()
      .single();

    if (data) set({ workday: data, manualStatus: null });
    window.dispatchEvent(new Event("oaos:workday-changed"));
  },

  async clockOut() {
    const { workday, activeEntryId } = get();
    if (!workday) return;
    const supabase = createClient();

    if (activeEntryId) {
      await get().stopTimer();
    }

    const { data } = await supabase
      .from("workdays")
      .update({ clocked_out_at: new Date().toISOString() })
      .eq("id", workday.id)
      .select()
      .single();

    if (data) set({ workday: data, manualStatus: "day_complete" });
    window.dispatchEvent(new Event("oaos:workday-changed"));
  },

  setManualStatus(status) {
    set({ manualStatus: status });
  },

  selectTask(taskId) {
    set({ selectedTaskId: taskId });
  },

  async startTimer() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let { workday } = get();
    if (!workday) {
      await get().clockIn();
      workday = get().workday;
      if (!workday) return;
    }

    const { selectedTaskId, nonNegotiables } = get();
    const task = nonNegotiables.find((t) => t.id === selectedTaskId);

    const { data } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        workday_id: workday.id,
        task_id: selectedTaskId,
        category: "other",
        is_productive: true,
        is_revenue_producing: task?.is_revenue_producing ?? false,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (data) {
      set({ activeEntryId: data.id, activeEntryStartedAt: data.started_at, activeEntryCategory: "work" });
    }
    set({ manualStatus: "working" });
  },

  async resumeTimer() {
    // If currently on break, close the break entry first (without crediting
    // its duration toward actual_minutes) before opening a new work entry.
    if (get().activeEntryCategory === "break") {
      await get()._endActiveEntry();
    }
    await get().startTimer();
  },

  async pauseTimer() {
    await get()._endActiveEntry();

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { workday } = get();
    if (!user || !workday) {
      set({ manualStatus: "on_break" });
      return;
    }

    const { data } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        workday_id: workday.id,
        task_id: null,
        category: "break",
        is_productive: false,
        is_revenue_producing: false,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (data) {
      set({ activeEntryId: data.id, activeEntryStartedAt: data.started_at, activeEntryCategory: "break" });
    }
    set({ manualStatus: "on_break" });
  },

  async stopTimer() {
    await get()._endActiveEntry();
    set({ selectedTaskId: null, manualStatus: null });
  },

  // internal helper — not part of the public action surface, but simplest
  // to colocate given both pause and stop need identical entry-closing logic.
  async _endActiveEntry() {
    const { activeEntryId, activeEntryStartedAt, activeEntryCategory, workday } = get();
    if (!activeEntryId || !activeEntryStartedAt) return;
    const supabase = createClient();

    const durationMinutes = Math.max(
      1,
      Math.round((Date.now() - new Date(activeEntryStartedAt).getTime()) / 60000)
    );

    await supabase
      .from("time_entries")
      .update({
        ended_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq("id", activeEntryId);

    // Break time is tracked in time_entries but never counted toward the
    // workday's actual_minutes — only real work does.
    if (workday && activeEntryCategory === "work") {
      await supabase
        .from("workdays")
        .update({ actual_minutes: workday.actual_minutes + durationMinutes })
        .eq("id", workday.id);
    }

    set({ activeEntryId: null, activeEntryStartedAt: null, activeEntryCategory: null });
    await get().refreshWorkday();
  },

  setBigSteinReviewing(value) {
    set({ bigSteinReviewing: value });
  },

  status() {
    const { workday, manualStatus, activeEntryId, activeEntryCategory } = get();
    if (manualStatus === "day_complete") return "day_complete";
    if (!workday?.clocked_in_at || workday.clocked_out_at) {
      return workday?.clocked_out_at ? "day_complete" : "not_clocked_in";
    }
    if (manualStatus === "in_field" || manualStatus === "in_meeting") return manualStatus;
    if (activeEntryCategory === "break") return "on_break";
    if (activeEntryId) return "working";
    if (manualStatus === "on_break") return "on_break";
    return "working";
  },
}));
