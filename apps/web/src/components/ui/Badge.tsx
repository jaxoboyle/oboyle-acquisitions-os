import { cn } from "@/lib/utils";

const VARIANTS = {
  neutral: "bg-bg-muted text-text-muted",
  brand: "bg-brand-muted text-brand",
  accent: "bg-accent-muted text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
} as const;

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span className={cn("badge", VARIANTS[variant], className)}>
      {children}
    </span>
  );
}
