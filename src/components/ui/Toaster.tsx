import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "@/lib/toast";
import { cn } from "@/lib/utils";

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const toneClasses = {
  success: "border-success/30 text-success",
  error: "border-danger/30 text-danger",
  info: "border-accent/30 text-accent",
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2 rounded-md border bg-surface px-3 py-2.5 text-sm shadow-lg",
              toneClasses[t.kind],
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 text-text">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="text-text-muted hover:text-text">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
