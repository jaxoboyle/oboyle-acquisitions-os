import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Columns3,
  Handshake,
  Users,
  CalendarCheck,
  Settings,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pipeline", label: "Seller Pipeline", icon: Columns3 },
  { to: "/deals", label: "Deal Tracker", icon: Handshake },
  { to: "/buyers", label: "Cash Buyers", icon: Users },
  { to: "/tasks", label: "Tasks & Calendar", icon: CalendarCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white">
          <Home size={14} />
        </div>
        <span className="text-[13px] font-semibold text-text">Wholesale CRM</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-surface-hover hover:text-text",
              )
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
