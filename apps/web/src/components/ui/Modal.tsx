"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-md",
  closeDisabled,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
  closeDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80" onClick={closeDisabled ? undefined : onClose} />
      <div
        className={cn("relative card w-full p-5 max-h-[85vh] overflow-y-auto", widthClassName)}
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text">{title}</h2>
            {description && <p className="text-sm text-text-muted mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text shrink-0 disabled:opacity-40"
            aria-label="Close"
            disabled={closeDisabled}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
