"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  CalendarClock,
  CheckSquare,
  Target,
  Landmark,
  Users,
  ShoppingBag,
  FileText,
  Clock,
  BarChart3,
  FolderOpen,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useWorkSession } from "@/lib/store/work-session";
import { cn } from "@/lib/utils";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Logo } from "@/components/layout/Logo";
import { WorkplaceStatusBar } from "@/components/layout/WorkplaceStatusBar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const NAV_ITEMS = [
  { href: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard },
  { href: "/chat",            label: "Text Big Stein",  icon: MessageSquare },
  { href: "/today",           label: "Today",           icon: CalendarDays },
  { href: "/tasks",           label: "Tasks",           icon: CheckSquare },
  { href: "/objectives",      label: "Objectives",      icon: Target },
  { href: "/company-vision",  label: "Company Vision",  icon: Landmark },
  { href: "/leads",           label: "Leads",           icon: Users },
  { href: "/followups",       label: "Follow Ups",      icon: CalendarClock },
  { href: "/buyers",          label: "Buyers",          icon: ShoppingBag },
  { href: "/deals",           label: "Deals",           icon: FileText },
  { href: "/time",            label: "Time",            icon: Clock },
  { href: "/reports",         label: "Reports",         icon: BarChart3 },
];

const BOTTOM_NAV = [
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/alerts",    label: "Alerts",    icon: Bell },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastEodReportId = useWorkSession((s) => s.lastEodReportId);

  // Navigate to the freshly-generated End-of-Day review the moment clockOut()
  // produces one (see lib/store/work-session.ts) — this is the "automatically
  // trigger" behavior the review is meant to have.
  useEffect(() => {
    if (lastEodReportId) router.push(`/reports/${lastEodReportId}`);
  }, [lastEodReportId, router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 flex-col bg-surface border-r border-surface-border",
          "hidden lg:flex"
        )}
      >
        <SidebarContent
          pathname={pathname}
          onLogout={handleLogout}
          userEmail={user.email ?? ""}
        />
      </aside>

      {/* ── Mobile sidebar overlay ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-surface border-r border-surface-border",
          "lg:hidden transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-surface-border">
          <Logo />
          <button onClick={() => setSidebarOpen(false)} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>
        <SidebarContent
          pathname={pathname}
          onLogout={handleLogout}
          userEmail={user.email ?? ""}
          onNavClick={() => setSidebarOpen(false)}
        />
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 lg:pl-60 min-w-0">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 px-4 h-14 border-b border-surface-border bg-surface lg:hidden shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-text-muted hover:text-text"
            >
              <Menu size={20} />
            </button>
            <Logo />
          </div>
          <NotificationBell />
        </header>

        {/* Desktop workplace status bar — live clock, status, alerts */}
        <WorkplaceStatusBar />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onLogout,
  userEmail,
  onNavClick,
}: {
  pathname: string;
  onLogout: () => void;
  userEmail: string;
  onNavClick?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 h-16 flex items-center border-b border-surface-border shrink-0">
        <Logo />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
            onClick={onNavClick}
          />
        ))}

        <div className="my-3 mx-2 divider-brass" />

        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname === item.href}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* User / logout */}
      <div className="border-t border-surface-border p-3 shrink-0">
        <Dropdown
          align="left"
          trigger={
            <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-surface-hover transition-colors">
              <div className="w-6 h-6 rounded-full bg-brand-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-brand">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-text-muted truncate flex-1 text-left">{userEmail}</span>
              <ChevronsUpDown size={12} className="text-text-subtle shrink-0" />
            </button>
          }
        >
          <DropdownItem href="/settings">
            <Settings size={14} />
            Settings
          </DropdownItem>
          <DropdownItem onClick={onLogout} danger>
            <LogOut size={14} />
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors mb-0.5",
        active
          ? "bg-brand-muted text-text font-medium"
          : "text-text-muted hover:text-text hover:bg-surface-hover"
      )}
    >
      <Icon size={16} className={active ? "text-brand" : "text-text-subtle"} />
      {label}
    </Link>
  );
}
