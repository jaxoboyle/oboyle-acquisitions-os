"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "left",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 min-w-[10rem] rounded border border-surface-border bg-surface-elevated shadow-lg py-1 animate-fade-in",
            align === "right" ? "right-0" : "left-0"
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  href,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = cn(
    "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors",
    danger ? "text-danger hover:bg-danger/10" : "text-text hover:bg-surface-hover"
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  );
}
