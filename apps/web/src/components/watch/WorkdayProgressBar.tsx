"use client";

import { useWorkSession } from "@/lib/store/work-session";
import { useNow } from "@/lib/store/clock";
import { formatMinutes, cn } from "@/lib/utils";

const BLOCK_COUNT = 4;

export function WorkdayProgressBar() {
  const workday = useWorkSession((s) => s.workday);
  const activeEntryId = useWorkSession((s) => s.activeEntryId);
  const activeEntryStartedAt = useWorkSession((s) => s.activeEntryStartedAt);
  const activeEntryCategory = useWorkSession((s) => s.activeEntryCategory);
  const breakMinutesBase = useWorkSession((s) => s.breakMinutesBase);
  const nonNegotiables = useWorkSession((s) => s.nonNegotiables);

  const nowMs = useNow();

  const targetMinutes = workday?.target_minutes ?? 600;
  const baseMinutes = workday?.actual_minutes ?? 0;

  const liveElapsed =
    activeEntryId && activeEntryStartedAt
      ? Math.max(0, (nowMs - new Date(activeEntryStartedAt).getTime()) / 60000)
      : 0;

  const workedMinutes = Math.max(
    0,
    activeEntryCategory === "work" ? baseMinutes + liveElapsed : baseMinutes
  );
  const breakMinutes = activeEntryCategory === "break" ? breakMinutesBase + liveElapsed : breakMinutesBase;

  const pct = Math.min(workedMinutes / targetMinutes, 1);
  const remaining = Math.max(targetMinutes - workedMinutes, 0);
  const blockSize = targetMinutes / BLOCK_COUNT;
  const currentBlock = Math.min(BLOCK_COUNT, Math.max(1, Math.floor(workedMinutes / blockSize) + 1));

  const nonNegSlice = nonNegotiables.slice(0, 3);

  return (
    <div className="w-full max-w-md">
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <div>
          <div className="label-tech">Hours Completed</div>
          <div className="num text-sm text-text">
            {formatMinutes(Math.round(workedMinutes))}
            <span className="text-text-subtle"> / {formatMinutes(targetMinutes)} target</span>
          </div>
        </div>
        <div className="text-right">
          <div className="label-tech">Complete</div>
          <div className="num text-sm text-accent">{Math.round(pct * 100)}%</div>
        </div>
      </div>

      {/* Horizontal bar with block dividers marking the day's four time blocks */}
      <div className="relative h-2.5 bg-bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${pct * 100}%` }}
        />
        {Array.from({ length: BLOCK_COUNT - 1 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-bg/60"
            style={{ left: `${((i + 1) / BLOCK_COUNT) * 100}%` }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="label-tech">
          Block <span className="num text-text">{currentBlock}</span>
          <span className="text-text-subtle"> / {BLOCK_COUNT}</span>
        </span>
        <span className="label-tech">
          Remaining <span className="num text-text">{formatMinutes(Math.round(remaining))}</span>
        </span>
        <span className="label-tech">
          Break <span className="num text-text">{formatMinutes(Math.round(breakMinutes))}</span>
        </span>
      </div>

      {nonNegSlice.length > 0 && (
        <div className="flex items-center gap-2 mt-3">
          <span className="label-tech">Non-Negotiables</span>
          <div className="flex items-center gap-1.5">
            {nonNegSlice.map((task) => (
              <span
                key={task.id}
                title={task.title}
                className={cn(
                  "w-2.5 h-2.5 rounded-full border",
                  task.completed
                    ? "bg-success border-success"
                    : "bg-transparent border-text-subtle"
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
