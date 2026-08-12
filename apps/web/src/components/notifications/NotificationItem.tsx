"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { formatRelative, cn } from "@/lib/utils";

const STATUS_VARIANT = {
  pending: "warning",
  sent: "brand",
  delivered: "brand",
  clicked: "success",
  dismissed: "neutral",
  failed: "danger",
} as const;

type Notification = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  status: string;
  scheduled_for: string;
  action_url: string | null;
};

export function NotificationItem({ notification }: { notification: Notification }) {
  const [status, setStatus] = useState(notification.status);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const isDismissed = status === "dismissed";

  async function dismiss() {
    setPending(true);
    const supabase = createClient();
    await supabase.from("notifications").update({ status: "dismissed" }).eq("id", notification.id);
    setStatus("dismissed");
    setPending(false);
    router.refresh();
  }

  return (
    <li className={cn("flex items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0", isDismissed && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={STATUS_VARIANT[status as keyof typeof STATUS_VARIANT] ?? "neutral"}>
            {status}
          </Badge>
          <span className="text-[11px] text-text-subtle">{formatRelative(notification.scheduled_for)}</span>
        </div>
        <p className="text-sm font-medium text-text">{notification.title}</p>
        <p className="text-sm text-text-muted mt-0.5">{notification.body}</p>
      </div>
      {!isDismissed && (
        <button
          onClick={dismiss}
          disabled={pending}
          className="shrink-0 text-text-subtle hover:text-text transition-colors mt-0.5"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </li>
  );
}
