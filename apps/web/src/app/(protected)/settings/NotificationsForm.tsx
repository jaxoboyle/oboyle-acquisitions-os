"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { formatRelative, cn } from "@/lib/utils";
import { Bell, MessageSquare, Loader2, ShieldCheck } from "lucide-react";

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

type CompanySettings = {
  id: string;
  notification_quiet_start?: string;
  notification_quiet_end?: string;
} | null;

type HistoryEntry = {
  id: string;
  channel: string;
  notification_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" | "danger" }> = {
  sent: { text: "Verification code sent — check your phone.", tone: "success" },
  saved: { text: "Phone number saved.", tone: "success" },
  verified: { text: "Phone number verified.", tone: "success" },
  not_configured: {
    text: "Text messaging is not configured yet. Add the three required Twilio environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) on the server.",
    tone: "warning",
  },
  invalid_number: { text: "That phone number is invalid.", tone: "danger" },
  rate_limited: { text: "Rate limit reached — try again shortly.", tone: "warning" },
  provider_error: { text: "The SMS provider returned an error.", tone: "danger" },
  no_subscription: { text: "No active push subscription yet.", tone: "warning" },
  device_subscribed: { text: "Device subscribed.", tone: "success" },
  test_notification_sent: { text: "Test notification sent — check this device.", tone: "success" },
  permission_denied: { text: "Permission denied.", tone: "danger" },
  must_be_hosted: { text: "App must be hosted through HTTPS.", tone: "warning" },
  push_subscription_failed: { text: "Push subscription failed.", tone: "danger" },
  vapid_missing: { text: "VAPID configuration missing.", tone: "warning" },
  ios_not_installed: {
    text: "App must be installed on the iPhone Home Screen. Open this link in Safari, tap Share → Add to Home Screen, then open OAOS from that icon and try again.",
    tone: "warning",
  },
  not_verified: { text: "Verify your phone number first.", tone: "warning" },
  no_saved_number: { text: "Save a phone number before verifying it.", tone: "warning" },
  consent_required: { text: "Consent is required before texting this number.", tone: "warning" },
  invalid_code: { text: "That code doesn't match.", tone: "danger" },
  expired: { text: "That code expired — request a new one.", tone: "danger" },
  too_many_attempts: { text: "Too many incorrect attempts — request a new code.", tone: "danger" },
  no_pending_code: { text: "No code is pending. Request one first.", tone: "warning" },
  failed: { text: "Send failed. Try again.", tone: "danger" },
};

function ResultBanner({ status, message }: { status: string; message?: string }) {
  const info = STATUS_MESSAGES[status] ?? { text: message ?? status, tone: "warning" as const };
  const toneClass = {
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
  }[info.tone];
  return (
    <p className={cn("text-xs px-3 py-2 rounded border mt-2", toneClass)}>
      {message ?? info.text}
    </p>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  busy,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  busy?: boolean;
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-text">{label}</span>
      <span className="flex items-center gap-2">
        {busy && <Loader2 size={12} className="animate-spin text-text-subtle" />}
        <button
          type="button"
          onClick={() => onChange(!checked)}
          disabled={busy}
          className={cn(
            "w-9 h-5 rounded-full transition-colors relative shrink-0 disabled:opacity-60",
            checked ? "bg-brand" : "bg-bg-muted border border-surface-border"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-brand-text transition-transform",
              checked ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </span>
    </label>
  );
}

export function NotificationsForm({
  prefs: initialPrefs,
  companySettings,
  history,
}: {
  prefs: NotificationPrefs;
  companySettings: CompanySettings;
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<{ status: string; message?: string } | null>(null);

  const [countryCode, setCountryCode] = useState(initialPrefs.phone_country_code || "+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const [code, setCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneResult, setPhoneResult] = useState<{ status: string; message?: string } | null>(null);
  const [smsTestResult, setSmsTestResult] = useState<{ status: string; message?: string } | null>(null);
  const [smsTestBusy, setSmsTestBusy] = useState(false);

  const [quietStart, setQuietStart] = useState(companySettings?.notification_quiet_start ?? "21:00");
  const [quietEnd, setQuietEnd] = useState(companySettings?.notification_quiet_end ?? "07:00");
  const [quietSaving, setQuietSaving] = useState(false);
  const [quietSaved, setQuietSaved] = useState(false);

  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
    // Computed only after mount — the server has no way to know the
    // visitor's device, so this must never affect the first-render output.
    setShowIosHint(isIOS() && !isStandalonePwa());
  }, []);

  async function updatePrefs(patch: Partial<NotificationPrefs>) {
    const previous = prefs;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setPrefsError(null);
    const keys = Object.keys(patch);
    setSavingKeys((s) => new Set([...s, ...keys]));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: prefs.user_id, ...patch }, { onConflict: "user_id" });
      if (error) {
        setPrefs(previous);
        setPrefsError("Could not save that change. Try again.");
      }
    } finally {
      setSavingKeys((s) => {
        const next = new Set(s);
        keys.forEach((k) => next.delete(k));
        return next;
      });
    }
  }

  // SMS consent goes through a dedicated route (not the generic updatePrefs
  // upsert above) so every grant/withdrawal is written to the audit trail —
  // required for SMS carrier registration compliance.
  async function toggleSmsConsent(enabled: boolean) {
    const previous = prefs.sms_enabled;
    setPrefs((p) => ({ ...p, sms_enabled: enabled }));
    setPrefsError(null);
    setSavingKeys((s) => new Set([...s, "sms_enabled"]));
    try {
      const res = await fetch("/api/notifications/sms/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        setPrefs((p) => ({ ...p, sms_enabled: previous }));
        setPrefsError("Could not update SMS consent. Try again.");
      } else {
        router.refresh();
      }
    } catch {
      setPrefs((p) => ({ ...p, sms_enabled: previous }));
      setPrefsError("Could not update SMS consent. Try again.");
    } finally {
      setSavingKeys((s) => {
        const next = new Set(s);
        next.delete("sms_enabled");
        return next;
      });
    }
  }

  async function enablePush() {
    setPushBusy(true);
    setPushResult(null);
    try {
      // Service workers (and therefore push) only work over HTTPS or on
      // localhost — a plain-HTTP deployment can never subscribe a device.
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setPushResult({ status: "must_be_hosted" });
        return;
      }
      // iOS Safari only exposes the Web Push API to a PWA that's been added
      // to the Home Screen and launched from there — never in a normal tab.
      if (isIOS() && !isStandalonePwa()) {
        setPushResult({ status: "ios_not_installed" });
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushResult({ status: "push_subscription_failed", message: "This browser doesn't support push notifications." });
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setPushResult({ status: "vapid_missing" });
        return;
      }

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult === "denied") {
        setPushResult({ status: "permission_denied", message: "Notification permission was denied in the browser. Allow notifications for this site to enable push." });
        return;
      }
      if (permissionResult !== "granted") {
        setPushResult({ status: "permission_denied", message: "Notification permission was not granted." });
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) throw new Error("Failed to save the subscription to the server.");
      setPrefs((p) => ({ ...p, push_enabled: true }));
      setPushResult({ status: "device_subscribed", message: "Device subscribed — this browser will now receive push notifications." });
      router.refresh();
    } catch (err) {
      setPushResult({
        status: "push_subscription_failed",
        message: err instanceof Error ? err.message : "Push subscription failed. Try again.",
      });
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        const sub = await registration?.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/notifications/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
      }
      setPrefs((p) => ({ ...p, push_enabled: false }));
      setPushResult(null);
      router.refresh();
    } finally {
      setPushBusy(false);
    }
  }

  async function sendTestPush() {
    setPushBusy(true);
    setPushResult(null);
    try {
      const res = await fetch("/api/notifications/push/test", { method: "POST" });
      const data = await res.json();
      // The server only ever reports "sent" once web-push has actually
      // confirmed delivery to the browser's push service — never assumed.
      setPushResult(data.status === "sent" ? { status: "test_notification_sent" } : data);
      router.refresh();
    } finally {
      setPushBusy(false);
    }
  }

  async function savePhoneNumber(e: React.FormEvent) {
    e.preventDefault();
    setPhoneBusy(true);
    setPhoneResult(null);
    try {
      const res = await fetch("/api/notifications/phone/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, phoneNumber, consent }),
      });
      const data = await res.json();
      setPhoneResult(data);
      if (data.status === "saved") {
        setPrefs((p) => ({ ...p, phone_e164: data.phone_e164, phone_country_code: countryCode, phone_status: "unverified" }));
        setEditingNumber(false);
        setPhoneNumber("");
        router.refresh();
      }
    } finally {
      setPhoneBusy(false);
    }
  }

  async function verifyPhoneNumber() {
    setPhoneBusy(true);
    setPhoneResult(null);
    try {
      const res = await fetch("/api/notifications/phone/send-code", { method: "POST" });
      const data = await res.json();
      setPhoneResult(data);
      if (data.status === "sent") setPrefs((p) => ({ ...p, phone_status: "pending" }));
    } finally {
      setPhoneBusy(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setPhoneBusy(true);
    setPhoneResult(null);
    try {
      const res = await fetch("/api/notifications/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setPhoneResult(data);
      if (data.status === "verified") {
        setPrefs((p) => ({ ...p, phone_status: "verified" }));
        router.refresh();
      }
    } finally {
      setPhoneBusy(false);
    }
  }

  async function removeNumber() {
    setPhoneBusy(true);
    setPhoneResult(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("notification_preferences")
      .update({ phone_e164: null, phone_status: "unverified", sms_enabled: false })
      .eq("user_id", prefs.user_id);
    setPhoneBusy(false);
    if (error) {
      setPhoneResult({ status: "failed", message: "Could not remove the number. Try again." });
      return;
    }
    setPrefs((p) => ({ ...p, phone_e164: null, phone_status: "unverified", sms_enabled: false }));
    setPhoneNumber("");
    router.refresh();
  }

  async function sendTestSms() {
    setSmsTestBusy(true);
    setSmsTestResult(null);
    try {
      const res = await fetch("/api/notifications/sms/test", { method: "POST" });
      const data = await res.json();
      setSmsTestResult(data);
    } finally {
      setSmsTestBusy(false);
    }
  }

  async function saveQuietHours(e: React.FormEvent) {
    e.preventDefault();
    setQuietSaving(true);
    setQuietSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("company_settings")
      .upsert(
        { user_id: prefs.user_id, notification_quiet_start: quietStart, notification_quiet_end: quietEnd },
        { onConflict: "user_id" }
      );
    setQuietSaving(false);
    if (!error) {
      setQuietSaved(true);
      router.refresh();
    }
  }

  const phoneStatusVariant = { unverified: "neutral", pending: "warning", verified: "success" } as const;
  const lastPushTest = history.find((h) => h.channel === "push" && h.notification_type === "test" && h.status === "sent");

  return (
    <div className="space-y-5">
      {/* ── Browser push ─────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={15} className="text-brand" />
          <h2 className="text-sm font-semibold text-text">Browser Push Notifications</h2>
        </div>
        <p className="text-xs text-text-muted mb-1">
          Browser permission:{" "}
          <span className="font-medium text-text">
            {permission === "unsupported" ? "Unsupported in this browser" : permission === "granted" ? "Notifications allowed" : permission === "denied" ? "Permission denied" : "Not yet requested"}
          </span>
        </p>
        <p className="text-xs text-text-muted mb-3">
          Device subscription:{" "}
          <span className="font-medium text-text">{prefs.push_enabled ? "Subscribed" : "Not subscribed"}</span>
        </p>

        {showIosHint && (
          <p className="text-xs px-3 py-2 rounded border mt-1 mb-3 bg-warning/10 text-warning border-warning/30">
            {STATUS_MESSAGES.ios_not_installed.text}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!prefs.push_enabled ? (
            <button onClick={enablePush} disabled={pushBusy || permission === "unsupported"} className="btn-primary text-sm">
              {pushBusy ? <Loader2 size={14} className="animate-spin" /> : "Enable Notifications"}
            </button>
          ) : (
            <>
              <Badge variant="success">Notifications Enabled</Badge>
              <button onClick={sendTestPush} disabled={pushBusy} className="btn-secondary text-sm">
                {pushBusy ? <Loader2 size={14} className="animate-spin" /> : "Send Test Push"}
              </button>
              <button onClick={disablePush} disabled={pushBusy} className="btn-secondary text-sm text-text-muted">
                {pushBusy ? <Loader2 size={14} className="animate-spin" /> : "Disable Notifications"}
              </button>
            </>
          )}
        </div>
        {pushResult && <ResultBanner status={pushResult.status} message={pushResult.message} />}
        {lastPushTest && (
          <p className="text-[11px] text-text-subtle mt-2">Last successful test: {formatRelative(lastPushTest.created_at)}</p>
        )}
      </div>

      {/* ── Phone / SMS ──────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-brand" />
            <h2 className="text-sm font-semibold text-text">Text Messages</h2>
          </div>
          <Badge variant={phoneStatusVariant[prefs.phone_status]}>{prefs.phone_status}</Badge>
        </div>

        {prefs.phone_e164 && !editingNumber ? (
          <div className="mt-2">
            <p className="text-sm text-text num">{prefs.phone_e164}</p>

            {prefs.phone_status === "verified" && (
              <ToggleRow
                label="SMS consent (text messages enabled)"
                checked={prefs.sms_enabled}
                onChange={toggleSmsConsent}
                busy={savingKeys.has("sms_enabled")}
              />
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {prefs.phone_status === "unverified" && (
                <button onClick={verifyPhoneNumber} disabled={phoneBusy} className="btn-primary text-sm">
                  {phoneBusy ? <Loader2 size={14} className="animate-spin" /> : "Verify Phone Number"}
                </button>
              )}
              {prefs.phone_status === "pending" && (
                <button onClick={verifyPhoneNumber} disabled={phoneBusy} className="btn-secondary text-sm">
                  {phoneBusy ? <Loader2 size={14} className="animate-spin" /> : "Resend Code"}
                </button>
              )}
              {prefs.phone_status === "verified" && (
                <button onClick={sendTestSms} disabled={smsTestBusy} className="btn-secondary text-sm">
                  {smsTestBusy ? <Loader2 size={14} className="animate-spin" /> : "Send Test Text"}
                </button>
              )}
              <button
                onClick={() => {
                  setCountryCode(prefs.phone_country_code || "+1");
                  setConsent(false);
                  setEditingNumber(true);
                }}
                disabled={phoneBusy}
                className="btn-secondary text-sm"
              >
                Change Number
              </button>
              <button onClick={removeNumber} disabled={phoneBusy} className="btn-secondary text-sm text-danger border-danger/30 hover:bg-danger/10">
                Remove Number
              </button>
            </div>
            {smsTestResult && <ResultBanner status={smsTestResult.status} message={smsTestResult.message} />}
          </div>
        ) : (
          <form onSubmit={savePhoneNumber} className="mt-3 space-y-3">
            <div className="flex gap-2">
              <input
                className="input w-20"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                placeholder="+1"
              />
              <input
                className="input"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <label className="flex items-start gap-2 text-xs text-text-muted">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 shrink-0" />
              <span>
                I agree to receive automated text messages from O&apos;Boyle Acquisition Operating System regarding
                task reminders, morning plans, overdue tasks, evening reviews, verification codes, and weekly
                reports. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or
                HELP for help. I have reviewed the{" "}
                <Link href="/privacy" target="_blank" className="text-brand hover:underline">Privacy Policy</Link>
                {" "}and{" "}
                <Link href="/terms" target="_blank" className="text-brand hover:underline">Terms</Link>.
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={phoneBusy || !phoneNumber || !consent} className="btn-primary text-sm">
                {phoneBusy ? <Loader2 size={14} className="animate-spin" /> : "Save Phone Number"}
              </button>
              {prefs.phone_e164 && (
                <button type="button" onClick={() => setEditingNumber(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
              )}
            </div>
            <p className="text-[11px] text-text-subtle">
              Saving only stores the number. Verification (sending a code through Twilio) is a separate step after.
            </p>
          </form>
        )}

        {prefs.phone_status === "pending" && (
          <form onSubmit={confirmCode} className="mt-4 pt-4 divider-brass space-y-2">
            <label className="block text-xs font-medium text-text-muted">Enter the 6-digit code you received</label>
            <div className="flex gap-2">
              <input className="input num" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
              <button type="submit" disabled={phoneBusy || code.length < 6} className="btn-primary text-sm shrink-0">
                <ShieldCheck size={14} />
              </button>
            </div>
          </form>
        )}

        {phoneResult && <ResultBanner status={phoneResult.status} message={phoneResult.message} />}
      </div>

      {/* ── Notification types ───────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text mb-1">Message Types</h2>
        <p className="text-xs text-text-muted mb-2">Applies to both push and text, where enabled above.</p>
        <div className="divide-y divide-surface-border">
          <ToggleRow label="Big Stein's Daily Orders (morning plan)" checked={prefs.morning_plan} onChange={(v) => updatePrefs({ morning_plan: v })} busy={savingKeys.has("morning_plan")} />
          <ToggleRow label="Task reminders" checked={prefs.task_reminders} onChange={(v) => updatePrefs({ task_reminders: v })} busy={savingKeys.has("task_reminders")} />
          <ToggleRow label="Overdue task alerts" checked={prefs.overdue_alerts} onChange={(v) => updatePrefs({ overdue_alerts: v })} busy={savingKeys.has("overdue_alerts")} />
          <ToggleRow label="Evening review" checked={prefs.evening_review} onChange={(v) => updatePrefs({ evening_review: v })} busy={savingKeys.has("evening_review")} />
          <ToggleRow label="Big Stein's Weekly Review (Sunday)" checked={prefs.sunday_report} onChange={(v) => updatePrefs({ sunday_report: v })} busy={savingKeys.has("sunday_report")} />
        </div>
        {prefsError && <ResultBanner status="failed" message={prefsError} />}
      </div>

      {/* ── Quiet hours ───────────────────────────────────────────────────── */}
      <form onSubmit={saveQuietHours} className="card p-5">
        <h2 className="text-sm font-semibold text-text mb-3">Quiet Hours</h2>
        <div className="flex items-center gap-3">
          <input
            type="time"
            className="input"
            value={quietStart}
            onChange={(e) => { setQuietStart(e.target.value); setQuietSaved(false); }}
          />
          <span className="text-text-subtle text-sm">to</span>
          <input
            type="time"
            className="input"
            value={quietEnd}
            onChange={(e) => { setQuietEnd(e.target.value); setQuietSaved(false); }}
          />
          <button type="submit" disabled={quietSaving} className="btn-secondary text-sm shrink-0">
            {quietSaving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
          {quietSaved && !quietSaving && <span className="text-xs text-success shrink-0">Saved</span>}
        </div>
        <p className="text-xs text-text-subtle mt-2">No push or text notifications are sent during quiet hours.</p>
      </form>

      {/* ── History ───────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <h2 className="text-sm font-semibold text-text px-5 pt-5 pb-3">Notification History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">No notifications sent yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border pb-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-text capitalize">
                    {h.channel} · {h.notification_type.replace(/_/g, " ")}
                  </p>
                  {h.error_message && <p className="text-[11px] text-danger truncate">{h.error_message}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={h.status === "sent" ? "success" : h.status === "failed" ? "danger" : "warning"}>{h.status}</Badge>
                  <span className="text-[11px] text-text-subtle">{formatRelative(h.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-text-subtle">
        <Link href="/privacy" className="hover:text-text hover:underline">Privacy Policy</Link>
        {" · "}
        <Link href="/terms" className="hover:text-text hover:underline">Terms &amp; Conditions</Link>
      </p>
    </div>
  );
}
