"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 border-b border-accent/30 mb-5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              active === tab.key
                ? "border-brand text-text"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab?.content}
    </div>
  );
}
