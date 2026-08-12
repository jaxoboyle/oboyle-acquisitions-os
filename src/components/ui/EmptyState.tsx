import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
      <Icon size={28} className="text-text-muted" />
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-xs text-[13px] text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
