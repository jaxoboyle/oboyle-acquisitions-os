import { cn } from "@/lib/utils";

const FILL = {
  brand: "bg-brand",
  accent: "bg-accent",
  success: "bg-success",
} as const;

export function ProgressBar({
  value,
  max = 100,
  variant = "brand",
  className,
}: {
  value: number;
  max?: number;
  variant?: keyof typeof FILL;
  className?: string;
}) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("h-2 bg-bg-muted rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full transition-all", FILL[variant])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
