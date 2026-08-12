import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-11 h-11 rounded-full bg-brand-muted flex items-center justify-center mb-4">
        <Icon size={20} className="text-brand" />
      </div>
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm">{description}</p>
      {action && (
        <Link href={action.href} className="btn-primary mt-5 text-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}
