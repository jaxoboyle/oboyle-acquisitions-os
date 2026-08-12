"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatRelative, cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  body: string;
  status: string;
  scheduled_for: string;
};

const ACTIVE_STATUSES = ["pending", "sent", "delivered"];

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, status, scheduled_for")
        .eq("user_id", user.id)
        .order("scheduled_for", { ascending: false })
        .limit(8);
      if (!cancelled) {
        setNotifications(data ?? []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const activeCount = notifications.filter((n) => ACTIVE_STATUSES.includes(n.status)).length;

  return (
    <Dropdown
      align="right"
      trigger={
        <button className="relative text-text-muted hover:text-text transition-colors p-1.5">
          <Bell size={17} />
          {activeCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-danger" />
          )}
        </button>
      }
    >
      <div className="w-72">
        <div className="px-3 py-2 label-tech border-b border-surface-border">Alerts</div>
        {loading ? (
          <p className="text-xs text-text-subtle text-center py-6">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-xs text-text-subtle text-center py-6">Nothing yet.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} className="px-3 py-2.5 border-b border-surface-border last:border-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", ACTIVE_STATUSES.includes(n.status) ? "bg-danger" : "bg-text-subtle")} />
                  <span className="text-[10px] text-text-subtle">{formatRelative(n.scheduled_for)}</span>
                </div>
                <p className="text-xs font-medium text-text">{n.title}</p>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/alerts"
          className="block text-center text-xs text-brand hover:underline py-2 border-t border-surface-border"
        >
          View all alerts
        </Link>
      </div>
    </Dropdown>
  );
}
