import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Bell } from "lucide-react";

export default async function AlertsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, notification_type, title, body, status, scheduled_for, action_url")
    .eq("user_id", user.id)
    .order("scheduled_for", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Alerts"
        description="Reminders and notifications from the O'Boyle Acquisition Operating System."
      />

      <div className="card p-5">
        {!notifications || notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alerts"
            description="Reminders for follow-ups, deadlines, and non-negotiables will appear here as they're scheduled."
          />
        ) : (
          <ul className="divide-y divide-surface-border">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
