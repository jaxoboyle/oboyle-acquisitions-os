import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
            active === tab.id
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
