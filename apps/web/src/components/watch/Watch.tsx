"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Play, Pause, Square, RotateCcw, Repeat } from "lucide-react";
import { useWorkSession, type WorkStatus } from "@/lib/store/work-session";
import { useNow, usePageHidden } from "@/lib/store/clock";
import { formatMinutes } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TaskPickerModal } from "./TaskPickerModal";
import { ClockOutNoteModal } from "./ClockOutNoteModal";

const STATUS_LABEL: Record<WorkStatus, string> = {
  not_clocked_in: "NOT CLOCKED IN",
  working: "WORKING",
  on_break: "ON BREAK",
  in_field: "IN THE FIELD",
  in_meeting: "IN A MEETING",
  day_complete: "DAY COMPLETE",
};

// "On Break" is deliberately not in this list — Pause/Resume now opens a
// real, DB-backed break time_entry (see work-session.ts), so a manual
// status toggle with the same label would show "ON BREAK" without actually
// tracking any break minutes.
const AWAY_STATES: { key: WorkStatus; label: string }[] = [
  { key: "in_field", label: "In the Field" },
  { key: "in_meeting", label: "In a Meeting" },
];

type HandOffsets = { second: number; minute: number; hour: number; date: number };

/**
 * Computed once, client-side only, after mount. Feeds a fixed-duration CSS
 * `animation-delay` per hand so the sweep is driven entirely by the
 * compositor timeline — not by React re-renders or a JS interval — which is
 * what makes it perfectly smooth and immune to setInterval drift/jank.
 */
function readHandOffsets(): HandOffsets {
  const d = new Date();
  const seconds = d.getSeconds() + d.getMilliseconds() / 1000;
  const minutes = d.getMinutes() * 60 + seconds;
  const hours = (d.getHours() % 12) * 3600 + minutes;
  return { second: seconds, minute: minutes, hour: hours, date: d.getDate() };
}

export function Watch({ size = "sm" }: { size?: "sm" | "lg" }) {
  const workday = useWorkSession((s) => s.workday);
  const activeEntryId = useWorkSession((s) => s.activeEntryId);
  const activeEntryStartedAt = useWorkSession((s) => s.activeEntryStartedAt);
  const activeEntryCategory = useWorkSession((s) => s.activeEntryCategory);
  const manualStatus = useWorkSession((s) => s.manualStatus);
  const currentTaskLabel = useWorkSession((s) => s.currentTaskLabel);
  const init = useWorkSession((s) => s.init);
  const clockIn = useWorkSession((s) => s.clockIn);
  const openTaskPicker = useWorkSession((s) => s.openTaskPicker);
  const openClockOutNote = useWorkSession((s) => s.openClockOutNote);
  const resumeTimer = useWorkSession((s) => s.resumeTimer);
  const pauseTimer = useWorkSession((s) => s.pauseTimer);
  const stopTimer = useWorkSession((s) => s.stopTimer);
  const setManualStatus = useWorkSession((s) => s.setManualStatus);
  const status = useWorkSession((s) => s.status);

  async function handleClockIn() {
    await clockIn();
    openTaskPicker("clock_in");
  }

  useEffect(() => {
    init();
  }, [init]);

  // Digital readout ticks once per second from the single shared clock.
  const nowMs = useNow();
  const tabHidden = usePageHidden();

  // Hand rotation is CSS-driven and set exactly once after mount — rendering
  // nothing time-dependent before that avoids any server/client mismatch.
  const [offsets, setOffsets] = useState<HandOffsets | null>(null);
  useEffect(() => {
    setOffsets(readHandOffsets());
  }, []);

  const diameter = size === "lg" ? 288 : 128;
  const cx = diameter / 2;
  const cy = diameter / 2;
  const r = diameter / 2 - (size === "lg" ? 10 : 6);

  const targetMinutes = workday?.target_minutes ?? 600;
  const baseMinutes = workday?.actual_minutes ?? 0;
  const liveMinutes =
    activeEntryId && activeEntryStartedAt && activeEntryCategory === "work"
      ? baseMinutes + (nowMs - new Date(activeEntryStartedAt).getTime()) / 60000
      : baseMinutes;
  const workedMinutes = Math.max(0, liveMinutes);
  const pct = Math.min(workedMinutes / targetMinutes, 1);
  const remaining = Math.max(targetMinutes - workedMinutes, 0);

  const currentStatus = status();
  const isWorking = !!activeEntryId && activeEntryCategory === "work";
  const isOnBreak = !!activeEntryId && activeEntryCategory === "break";
  const isClockedIn = !!workday?.clocked_in_at && !workday?.clocked_out_at;

  // Subdial (6 o'clock) — daily-target progress arc
  const subR = size === "lg" ? 34 : 16;
  const subCx = cx;
  const subCy = cy + r * 0.5;
  const subCirc = 2 * Math.PI * subR;

  const handStyle = (durationSec: number, offsetSec: number): CSSProperties => ({
    transformOrigin: `${cx}px ${cy}px`,
    transform: offsets ? undefined : "rotate(0deg)",
    animationName: offsets ? "watch-hand-sweep" : "none",
    animationDuration: `${durationSec}s`,
    animationDelay: `-${offsetSec}s`,
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    animationPlayState: tabHidden ? "paused" : "running",
    opacity: offsets ? 1 : 0,
    transition: "opacity 300ms ease-out",
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: diameter, height: diameter }}>
        <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
          <defs>
            <pattern id={`watch-waffle-${size}`} width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M0 6L6 0" stroke="hsl(var(--surface-border))" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Bezel — continuous graduated ring, integrated-sport-watch style */}
          <circle cx={cx} cy={cy} r={r} fill={`url(#watch-waffle-${size})`} stroke="hsl(var(--silver))" strokeWidth={size === "lg" ? 3 : 2} />
          <circle cx={cx} cy={cy} r={r} fill="hsl(var(--surface-elevated))" fillOpacity={0.55} />
          <circle cx={cx} cy={cy} r={r - (size === "lg" ? 6 : 3)} fill="none" stroke="hsl(var(--surface-border))" strokeWidth={1} />

          {/* Graduated minute track around the full bezel */}
          {Array.from({ length: 60 }).map((_, i) => {
            if (i % 5 === 0) return null;
            const angle = (i * 6 * Math.PI) / 180;
            const outer = r - (size === "lg" ? 6 : 3);
            const inner = outer - (size === "lg" ? 4 : 2);
            const x1 = cx + outer * Math.sin(angle);
            const y1 = cy - outer * Math.cos(angle);
            const x2 = cx + inner * Math.sin(angle);
            const y2 = cy - inner * Math.cos(angle);
            return (
              <line key={`m${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--surface-border))" strokeWidth={0.75} />
            );
          })}

          {/* Bold applied hour batons */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const outer = r - (size === "lg" ? 12 : 7);
            const inner = outer - (i % 3 === 0 ? (size === "lg" ? 16 : 8) : (size === "lg" ? 10 : 5));
            const x1 = cx + outer * Math.sin(angle);
            const y1 = cy - outer * Math.cos(angle);
            const x2 = cx + inner * Math.sin(angle);
            const y2 = cy - inner * Math.cos(angle);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i % 3 === 0 ? "hsl(var(--accent))" : "hsl(var(--silver))"}
                strokeWidth={i % 3 === 0 ? 3 : 1.75}
                strokeLinecap="round"
              />
            );
          })}

          {/* Daily-target subdial */}
          <circle cx={subCx} cy={subCy} r={subR} fill="none" stroke="hsl(var(--surface-border))" strokeWidth={size === "lg" ? 3 : 2} />
          <circle
            cx={subCx} cy={subCy} r={subR}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth={size === "lg" ? 3 : 2}
            strokeDasharray={subCirc}
            strokeDashoffset={subCirc * (1 - pct)}
            strokeLinecap="round"
            transform={`rotate(-90 ${subCx} ${subCy})`}
            style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
          />
          {size === "lg" && (
            <text x={subCx} y={subCy + 4} textAnchor="middle" fontSize="9" fill="hsl(var(--text-subtle))" className="font-mono">
              {Math.round(pct * 100)}%
            </text>
          )}

          {/* Date window */}
          <g>
            <rect x={cx + r * 0.42} y={cy - (size === "lg" ? 9 : 5)} width={size === "lg" ? 20 : 11} height={size === "lg" ? 18 : 10} fill="hsl(var(--bg))" stroke="hsl(var(--silver))" strokeWidth={0.75} />
            <text
              x={cx + r * 0.42 + (size === "lg" ? 10 : 5.5)}
              y={cy + (size === "lg" ? 5 : 3)}
              textAnchor="middle"
              fontSize={size === "lg" ? 12 : 7}
              fill="hsl(var(--text))"
              className="font-mono"
              style={{ opacity: offsets ? 1 : 0, transition: "opacity 300ms ease-out" }}
            >
              {offsets?.date ?? ""}
            </text>
          </g>

          {/* Hour hand */}
          <line
            className="watch-hand"
            x1={cx} y1={cy} x2={cx} y2={cy - r * 0.5}
            stroke="hsl(var(--text))" strokeWidth={size === "lg" ? 4 : 2.5} strokeLinecap="round"
            style={handStyle(43200, offsets?.hour ?? 0)}
          />
          {/* Minute hand */}
          <line
            className="watch-hand"
            x1={cx} y1={cy} x2={cx} y2={cy - r * 0.72}
            stroke="hsl(var(--text))" strokeWidth={size === "lg" ? 2.5 : 1.5} strokeLinecap="round"
            style={handStyle(3600, offsets?.minute ?? 0)}
          />
          {/* Second hand — speedway red, one continuous compositor-driven sweep */}
          <line
            className="watch-hand"
            x1={cx} y1={cy + r * 0.15} x2={cx} y2={cy - r * 0.8}
            stroke="hsl(var(--danger))" strokeWidth={size === "lg" ? 1.5 : 1}
            style={handStyle(60, offsets?.second ?? 0)}
          />
          <circle cx={cx} cy={cy} r={size === "lg" ? 4 : 2.5} fill="hsl(var(--accent))" />
        </svg>

        {isWorking && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-success animate-pulse" />
        )}
      </div>

      {/* Status + digital readout */}
      <div className="mt-3 text-center">
        <div className="label-tech flex items-center justify-center gap-1.5">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              currentStatus === "working" && "bg-success animate-pulse",
              currentStatus === "not_clocked_in" && "bg-text-subtle",
              currentStatus === "on_break" && "bg-warning",
              currentStatus === "day_complete" && "bg-brand",
              (currentStatus === "in_field" || currentStatus === "in_meeting") && "bg-accent"
            )}
          />
          {STATUS_LABEL[currentStatus]}
        </div>
        <div className="num text-sm text-text mt-1">
          {formatMinutes(Math.round(workedMinutes))}
          <span className="text-text-subtle"> / {formatMinutes(targetMinutes)}</span>
        </div>
        {size === "lg" && (
          <div className="num text-xs text-text-subtle mt-0.5">
            {remaining === 0 ? "Target reached" : `${formatMinutes(Math.round(remaining))} remaining`}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-col items-center gap-2 w-full">
        {!isClockedIn ? (
          <button onClick={handleClockIn} className="btn-primary flex items-center gap-2 text-sm">
            <Play size={14} /> Clock In
          </button>
        ) : (
          <>
            {isWorking && currentTaskLabel && (
              <p className="text-xs text-text-muted text-center max-w-[220px] truncate" title={currentTaskLabel}>
                Working on <span className="text-text font-medium">{currentTaskLabel}</span>
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap justify-center">
              {!isWorking && !isOnBreak && (
                <button
                  onClick={() => openTaskPicker("clock_in")}
                  className="btn-primary flex items-center gap-1.5 text-sm"
                >
                  <Play size={13} /> Start
                </button>
              )}
              {isOnBreak && (
                <button onClick={() => resumeTimer()} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Play size={13} /> Resume
                </button>
              )}
              {isWorking && (
                <>
                  <button
                    onClick={() => openTaskPicker("switch")}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <Repeat size={13} /> Switch Task
                  </button>
                  <button onClick={() => pauseTimer()} className="btn-secondary flex items-center gap-1.5 text-sm">
                    <Pause size={13} /> Pause
                  </button>
                  <button onClick={() => stopTimer()} className="btn-secondary flex items-center gap-1.5 text-sm">
                    <Square size={13} /> Stop
                  </button>
                </>
              )}
              <button
                onClick={() => openClockOutNote()}
                className="btn-secondary flex items-center gap-1.5 text-sm border-danger/40 text-danger hover:bg-danger/10"
              >
                <RotateCcw size={13} /> Clock Out
              </button>
            </div>

            {size === "lg" && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                {AWAY_STATES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setManualStatus(manualStatus === s.key ? null : s.key)}
                    className={cn(
                      "label-tech px-2 py-1 rounded border transition-colors",
                      manualStatus === s.key
                        ? "border-accent text-accent bg-accent-muted"
                        : "border-surface-border text-text-subtle hover:text-text hover:border-text-subtle"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <TaskPickerModal />
      <ClockOutNoteModal />
    </div>
  );
}
