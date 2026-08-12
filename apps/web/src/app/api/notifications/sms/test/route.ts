import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSmsProvider } from "@/lib/sms";
import { last4 } from "@/lib/sms/phone";
import { logSms, logDelivery } from "@/lib/notifications/log";
import { isRateLimited } from "@/lib/notifications/rate-limit";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("phone_e164, phone_status, sms_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!prefs?.phone_e164 || prefs.phone_status !== "verified") {
    return NextResponse.json({
      status: "not_verified",
      message: "Add and verify a phone number before sending a test text.",
    });
  }

  if (!prefs.sms_enabled) {
    return NextResponse.json({
      status: "consent_required",
      message: "SMS consent is currently off. Turn it back on above before sending a test text.",
    });
  }

  if (await isRateLimited(supabase, user.id, "sms", 3, 10)) {
    await logSms(user.id, last4(prefs.phone_e164), "rate_limited");
    await logDelivery(user.id, "sms", "test", "rate_limited");
    return NextResponse.json({ status: "rate_limited", message: "Too many test texts sent. Wait a few minutes and try again." });
  }

  const provider = getSmsProvider();
  const result = await provider.send(
    prefs.phone_e164,
    "O'Boyle Acquisition OS — this is a test text from Big Stein. SMS notifications are working."
  );

  if (!result.ok) {
    await logSms(user.id, last4(prefs.phone_e164), result.reason === "provider_error" ? "failed" : result.reason, undefined, result.message);
    await logDelivery(user.id, "sms", "test", result.reason === "not_configured" ? "not_configured" : "failed", result.message);
    return NextResponse.json({ status: result.reason, message: result.message });
  }

  await logSms(user.id, last4(prefs.phone_e164), "sent", result.providerMessageId);
  await logDelivery(user.id, "sms", "test", "sent");
  return NextResponse.json({ status: "sent" });
}
