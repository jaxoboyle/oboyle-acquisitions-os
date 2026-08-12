import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  onClick?: () => void;
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-surface-hover text-text-muted",
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  };

  return (
    <Card
      className={cn(
        "flex items-center gap-3 p-4",
        onClick && "cursor-pointer transition-colors hover:bg-surface-hover",
      )}
      onClick={onClick}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12px] text-text-muted">{label}</div>
        <div className="text-lg font-semibold text-text">{value}</div>
      </div>
    </Card>
  );
}
