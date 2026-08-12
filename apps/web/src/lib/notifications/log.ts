import { createAdminClient } from "@/lib/supabase/server";

type DeliveryStatus = "sent" | "failed" | "rate_limited" | "not_configured";

/** Writes to notification_deliveries via the service-role client — RLS only grants clients SELECT. */
export async function logDelivery(
  userId: string,
  channel: "push" | "sms",
  notificationType: string,
  status: DeliveryStatus,
  errorMessage?: string
) {
  const admin = createAdminClient();
  await admin.from("notification_deliveries").insert({
    user_id: userId,
    channel,
    notification_type: notificationType,
    status,
    error_message: errorMessage ?? null,
  });
}

type SmsStatus = "sent" | "failed" | "rate_limited" | "not_configured" | "invalid_number";

/** Writes to sms_logs — stores only the last 4 digits of the destination number, never the full number or any secret. */
export async function logSms(
  userId: string,
  toLast4: string | null,
  status: SmsStatus,
  providerMessageId?: string,
  errorMessage?: string
) {
  const admin = createAdminClient();
  await admin.from("sms_logs").insert({
    user_id: userId,
    to_phone_last4: toLast4,
    status,
    provider_message_id: providerMessageId ?? null,
    error_message: errorMessage ?? null,
  });
}
