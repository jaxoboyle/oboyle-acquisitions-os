import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const [
    { data: profile },
    { data: companySettings },
    { data: notificationPrefs },
    { data: history },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("notification_deliveries")
      .select("id, channel, notification_type, status, error_message, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const resolvedProfile = profile ?? {
    id: user.id,
    email: user.email ?? null,
    full_name: null,
    timezone: "America/New_York",
    daily_work_target_minutes: 600,
    sunday_work_target_minutes: 180,
  };

  const resolvedNotificationPrefs = notificationPrefs ?? {
    user_id: user.id,
    phone_e164: null,
    phone_country_code: "+1",
    phone_status: "unverified" as const,
    push_enabled: false,
    sms_enabled: false,
    morning_plan: true,
    task_reminders: true,
    overdue_alerts: true,
    evening_review: true,
    sunday_report: true,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <PageHeader title="Settings" description="Your profile, company, and notification configuration." />
      <SettingsClient
        profile={resolvedProfile}
        companySettings={companySettings ?? null}
        notificationPrefs={resolvedNotificationPrefs}
        history={history ?? []}
      />
    </div>
  );
}
