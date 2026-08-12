"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useWorkSession, type WorkStatus } from "@/lib/store/work-session";
import { useNow } from "@/lib/store/clock";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const STATUS_LABEL: Record<WorkStatus, string> = {
  not_clocked_in: "Not Clocked In",
  working: "Working",
  on_break: "On Break",
  in_field: "In the Field",
  in_meeting: "In a Meeting",
  day_complete: "Day Complete",
};

const STATUS_DOT: Record<WorkStatus, string> = {
  not_clocked_in: "bg-text-subtle",
  working: "bg-success animate-pulse",
  on_break: "bg-warning",
  in_field: "bg-accent",
  in_meeting: "bg-accent",
  day_complete: "bg-brand",
};

export function WorkplaceStatusBar() {
  const nowMs = useNow();
  const init = useWorkSession((s) => s.init);
  const status = useWorkSession((s) => s.status)();
  const nonNegotiables = useWorkSession((s) => s.nonNegotiables);
  const bigSteinReviewing = useWorkSession((s) => s.bigSteinReviewing);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    init();
    setMounted(true);
  }, [init]);

  // The server has no way to know the visitor's real clock, so the digital
  // readout renders blank until after mount — matching what the server sent
  // exactly, then filling in once the client's own time is available.
  const now = new Date(nowMs);
  const timeLabel = mounted
    ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "";
  const dateLabel = mounted
    ? now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";

  const nonNegDone = nonNegotiables.filter((t) => t.completed).length;
  const nonNegTotal = nonNegotiables.length;

  return (
    <header className="hidden lg:flex items-center justify-between gap-4 h-14 px-6 border-b border-surface-border bg-surface shrink-0 texture-grid">
      <div className="flex items-center gap-5 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />
          <span className="text-xs font-medium text-text">{STATUS_LABEL[status]}</span>
        </div>

        {nonNegTotal > 0 && (
          <span className="label-tech">
            Non-negotiables{" "}
            <span className={cn("num", nonNegDone === nonNegTotal ? "text-success" : "text-text")}>
              {nonNegDone}/{nonNegTotal}
            </span>
          </span>
        )}

        {bigSteinReviewing && (
          <span className="flex items-center gap-1.5 text-xs text-accent">
            <Loader2 size={12} className="animate-spin" />
            Big Stein is reviewing…
          </span>
        )}
      </div>

      <div className="flex items-center gap-5 shrink-0">
        <div className="text-right leading-none">
          <div className="num text-sm text-text">{timeLabel}</div>
          <div className="label-tech mt-0.5">{dateLabel}</div>
        </div>
        <NotificationBell />
      </div>
    </header>
  );
}
