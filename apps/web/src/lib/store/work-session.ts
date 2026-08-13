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

export type PickableTask = {
  id: string;
  title: string;
  is_revenue_producing: boolean;
  is_non_negotiable: boolean;
  estimated_minutes: number | null;
  actual_minutes: number | null;
};

export type WorkStatus =
  | "not_clocked_in"
  | "working"
  | "on_break"
  | "in_field"
  | "in_meeting"
  | "day_complete";

export type TaskChoice = { taskId: string | null; unplannedNote?: string };

type WorkSessionState = {
  initialized: boolean;
  loading: boolean;
  workday: Workday;
  nonNegotiables: TodayTask[];
  pickableTasks: PickableTask[];
  selectedTaskId: string | null;
  currentTaskLabel: string | null;
  activeEntryId: string | null;
  activeEntryStartedAt: string | null;
  activeEntryCategory: "work" | "break" | null;
  breakMinutesBase: number;
  manualStatus: WorkStatus | null;
  bigSteinReviewing: boolean;
  lastEodReportId: string | null;
  taskPickerOpen: boolean;
  taskPickerReason: "clock_in" | "switch" | null;
  clockOutNoteOpen: boolean;

  init: () => Promise<void>;
  refreshWorkday: () => Promise<void>;
  refreshNonNegotiables: () => Promise<void>;
  refreshPickableTasks: () => Promise<void>;
  clockIn: () => Promise<void>;
  clockOut: (note?: string) => Promise<void>;
  setManualStatus: (status: WorkStatus | null) => void;
  openTaskPicker: (reason: "clock_in" | "switch") => void;
  closeTaskPicker: () => void;
  beginTask: (choice: TaskChoice) => Promise<void>;
  openClockOutNote: () => void;
  closeClockOutNote: () => void;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  setBigSteinReviewing: (value: boolean) => void;
  status: () => WorkStatus;
  /** @internal shared by pauseTimer/stopTimer/beginTask — not for direct use */
  _endActiveEntry: () => Promise<void>;
};

let listenerAttached = false;

export const useWorkSession = create<WorkSessionState>((set, get) => ({
  initialized: false,
  loading: false,
  workday: null,
  nonNegotiables: [],
  pickableTasks: [],
  selectedTaskId: null,
  currentTaskLabel: null,
  activeEntryId: null,
  activeEntryStartedAt: null,
  activeEntryCategory: null,
  breakMinutesBase: 0,
  manualStatus: null,
  bigSteinReviewing: false,
  lastEodReportId: null,
  taskPickerOpen: false,
  taskPickerReason: null,
  clockOutNoteOpen: false,

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
        .select("id, started_at, ended_at, task_id, category, notes, duration_minutes")
        .eq("user_id", user.id)
        .gte("started_at", dayStart)
        .lte("started_at", dayEnd)
        .order("started_at", { ascending: false }),
    ]);

    const active = (entries ?? []).find((e) => !e.ended_at) ?? null;
    const breakMinutesBase = (entries ?? [])
      .filter((e) => e.category === "break" && e.ended_at)
      .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

    // Only overwrite currentTaskLabel from a rediscovered active entry (e.g.
    // after a page reload) — don't clobber state that beginTask() just set
    // locally in the same session. Fetched directly rather than from
    // pickableTasks, which may not be populated yet on a fresh page load.
    const rediscovered = active && active.task_id !== get().selectedTaskId;
    let currentTaskLabel = get().currentTaskLabel;
    if (rediscovered) {
      if (active!.task_id) {
        const { data: task } = await supabase.from("tasks").select("title").eq("id", active!.task_id).maybeSingle();
        currentTaskLabel = task?.title ?? "Task";
      } else {
        currentTaskLabel = active!.notes ? `Other: ${active!.notes}` : "General work";
      }
    }
    if (!active) currentTaskLabel = null;

    set({
      workday: workday ?? null,
      activeEntryId: active?.id ?? null,
      activeEntryStartedAt: active?.started_at ?? null,
      activeEntryCategory: active ? (active.category === "break" ? "break" : "work") : null,
      breakMinutesBase,
      selectedTaskId: active?.task_id ?? (active ? null : get().selectedTaskId),
      currentTaskLabel,
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

  // Broader than nonNegotiables — every open task, for the "what are you
  // working on" picker. Non-negotiables sort first.
  async refreshPickableTasks() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("tasks")
      .select("id, title, is_revenue_producing, is_non_negotiable, estimated_minutes, actual_minutes")
      .eq("user_id", user.id)
      .eq("completed", false)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .order("is_non_negotiable", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50);

    set({ pickableTasks: data ?? [] });
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

  async clockOut(note) {
    const { workday, activeEntryId } = get();
    if (!workday) return;
    const supabase = createClient();

    if (activeEntryId) {
      await get()._endActiveEntry();
    }

    const { data } = await supabase
      .from("workdays")
      .update({
        clocked_out_at: new Date().toISOString(),
        ...(note ? { daily_notes: note } : {}),
      })
      .eq("id", workday.id)
      .select()
      .single();

    if (data) set({ workday: data, manualStatus: "day_complete" });
    set({ clockOutNoteOpen: false, taskPickerOpen: false, taskPickerReason: null });
    window.dispatchEvent(new Event("oaos:workday-changed"));

    // End-of-day CEO review — built from today's actual data, not generic
    // text (see lib/ai/eod-review.ts). bigSteinReviewing already drives the
    // "Big Stein is reviewing…" indicator in WorkplaceStatusBar.
    set({ bigSteinReviewing: true });
    try {
      const res = await fetch("/api/eod-review/generate", { method: "POST" });
      if (res.ok) {
        const result = (await res.json()) as { report_id: string };
        set({ lastEodReportId: result.report_id });
      }
    } catch {
      // Non-fatal — the workday is already clocked out; the review can be
      // regenerated by revisiting Reports if this request failed.
    } finally {
      set({ bigSteinReviewing: false });
    }
  },

  setManualStatus(status) {
    set({ manualStatus: status });
  },

  openTaskPicker(reason) {
    get().refreshPickableTasks();
    set({ taskPickerOpen: true, taskPickerReason: reason });
  },

  closeTaskPicker() {
    set({ taskPickerOpen: false, taskPickerReason: null });
  },

  // The single entry point for starting work on something — used both for
  // the first task after clocking in and for Switch Task. Ends whatever's
  // currently active first, so "switch" is just "end current, begin next."
  async beginTask(choice) {
    if (get().activeEntryId) {
      await get()._endActiveEntry();
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let { workday } = get();
    if (!workday) {
      await get().clockIn();
      workday = get().workday;
      if (!workday) return;
    }

    const task = choice.taskId ? get().pickableTasks.find((t) => t.id === choice.taskId) : null;
    const unplannedNote = choice.taskId ? null : (choice.unplannedNote?.trim() || null);

    const { data } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        workday_id: workday.id,
        task_id: choice.taskId,
        category: "other",
        is_productive: true,
        is_revenue_producing: task?.is_revenue_producing ?? false,
        notes: unplannedNote,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (data) {
      set({
        activeEntryId: data.id,
        activeEntryStartedAt: data.started_at,
        activeEntryCategory: "work",
        selectedTaskId: choice.taskId,
        currentTaskLabel: task ? task.title : unplannedNote ? `Other: ${unplannedNote}` : "General work",
      });
    }
    set({ manualStatus: "working", taskPickerOpen: false, taskPickerReason: null });
  },

  openClockOutNote() {
    set({ clockOutNoteOpen: true });
  },

  closeClockOutNote() {
    set({ clockOutNoteOpen: false });
  },

  async resumeTimer() {
    // If currently on break, close the break entry first (without crediting
    // its duration toward actual_minutes) before resuming the same task.
    if (get().activeEntryCategory === "break") {
      await get()._endActiveEntry();
    }
    await get().beginTask({ taskId: get().selectedTaskId });
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
    set({ selectedTaskId: null, currentTaskLabel: null, manualStatus: null });
  },

  // internal helper — not part of the public action surface, but simplest
  // to colocate given pause/stop/beginTask all need identical entry-closing
  // logic.
  async _endActiveEntry() {
    const { activeEntryId, activeEntryStartedAt, activeEntryCategory, workday, selectedTaskId } = get();
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

      // Combine every session against a task into its running total —
      // leaving and coming back to a task adds up rather than overwrites.
      if (selectedTaskId) {
        const { data: taskRow } = await supabase
          .from("tasks")
          .select("actual_minutes")
          .eq("id", selectedTaskId)
          .single();
        if (taskRow) {
          await supabase
            .from("tasks")
            .update({ actual_minutes: (taskRow.actual_minutes ?? 0) + durationMinutes })
            .eq("id", selectedTaskId);
          window.dispatchEvent(new Event("oaos:tasks-changed"));
        }
      }
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
