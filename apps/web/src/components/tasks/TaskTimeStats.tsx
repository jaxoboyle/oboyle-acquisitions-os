import { formatMinutes } from "@/lib/utils";

/**
 * Estimated vs. actual + session count — shown inline under a task row
 * whenever there's real time data to show. actual_minutes already
 * represents the sum of every tracked session against this task (see
 * work-session.ts's _endActiveEntry), not just the most recent one.
 */
export function TaskTimeStats({
  estimatedMinutes,
  actualMinutes,
  sessionCount,
}: {
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  sessionCount: number;
}) {
  if (estimatedMinutes == null && actualMinutes == null) return null;

  const variance = estimatedMinutes != null && actualMinutes != null ? actualMinutes - estimatedMinutes : null;

  return (
    <p className="text-[11px] text-text-subtle mt-1 num">
      {estimatedMinutes != null && <>Est {formatMinutes(estimatedMinutes)}</>}
      {estimatedMinutes != null && actualMinutes != null && " · "}
      {actualMinutes != null && <>Actual {formatMinutes(actualMinutes)}</>}
      {variance != null && (
        <span className={variance > 0 ? "text-warning" : "text-success"}>
          {" "}
          ({variance >= 0 ? "+" : "-"}
          {formatMinutes(Math.abs(variance))})
        </span>
      )}
      {sessionCount > 0 && <> · {sessionCount} session{sessionCount === 1 ? "" : "s"}</>}
    </p>
  );
}
