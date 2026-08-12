"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs } from "@/components/ui/Tabs";
import { Check } from "lucide-react";
import { NotificationsForm } from "./NotificationsForm";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  timezone: string;
  daily_work_target_minutes: number;
  sunday_work_target_minutes: number;
};

type CompanySettings = {
  id: string;
  company_name: string;
  thirty_day_revenue_target: number;
  notification_quiet_start?: string;
  notification_quiet_end?: string;
} | null;

type NotificationPrefs = {
  user_id: string;
  phone_e164: string | null;
  phone_country_code: string;
  phone_status: "unverified" | "pending" | "verified";
  push_enabled: boolean;
  sms_enabled: boolean;
  morning_plan: boolean;
  task_reminders: boolean;
  overdue_alerts: boolean;
  evening_review: boolean;
  sunday_report: boolean;
};

type HistoryEntry = {
  id: string;
  channel: string;
  notification_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

export function SettingsClient({
  profile,
  companySettings,
  notificationPrefs,
  history,
}: {
  profile: Profile;
  companySettings: CompanySettings;
  notificationPrefs: NotificationPrefs;
  history: HistoryEntry[];
}) {
  return (
    <Tabs
      tabs={[
        { key: "profile", label: "Profile", content: <ProfileForm profile={profile} /> },
        { key: "company", label: "Company", content: <CompanyForm companySettings={companySettings} userId={profile.id} /> },
        {
          key: "notifications",
          label: "Notifications",
          content: (
            <NotificationsForm prefs={notificationPrefs} companySettings={companySettings} history={history} />
          ),
        },
      ]}
    />
  );
}

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <Check size={13} /> Saved
    </span>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [dailyTarget, setDailyTarget] = useState(profile.daily_work_target_minutes);
  const [sundayTarget, setSundayTarget] = useState(profile.sunday_work_target_minutes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        timezone,
        daily_work_target_minutes: dailyTarget,
        sunday_work_target_minutes: sundayTarget,
      })
      .eq("id", profile.id);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-4 max-w-lg">
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Full name</label>
        <input
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
        <input className="input opacity-60" value={profile.email ?? ""} disabled />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Timezone</label>
        <input
          className="input"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/New_York"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Daily target (min)
          </label>
          <input
            type="number"
            min={0}
            className="input"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Sunday target (min)
          </label>
          <input
            type="number"
            min={0}
            className="input"
            value={sundayTarget}
            onChange={(e) => setSundayTarget(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save profile"}
        </button>
        <SavedBadge show={saved && !saving} />
      </div>
    </form>
  );
}

function CompanyForm({
  companySettings,
  userId,
}: {
  companySettings: CompanySettings;
  userId: string;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(companySettings?.company_name ?? "");
  const [revenueTarget, setRevenueTarget] = useState(
    companySettings?.thirty_day_revenue_target ?? 10000
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("company_settings")
      .upsert(
        {
          user_id: userId,
          company_name: companyName,
          thirty_day_revenue_target: revenueTarget,
        },
        { onConflict: "user_id" }
      );
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-4 max-w-lg">
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">Company name</label>
        <input
          className="input"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="My Real Estate Company"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">
          30-day revenue target
        </label>
        <input
          type="number"
          min={0}
          className="input font-serif"
          value={revenueTarget}
          onChange={(e) => setRevenueTarget(Number(e.target.value))}
        />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save company"}
        </button>
        <SavedBadge show={saved && !saving} />
      </div>
    </form>
  );
}
