import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-hover text-text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-normal",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const priorityTone: Record<Priority, Tone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={priorityTone[priority]}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}
