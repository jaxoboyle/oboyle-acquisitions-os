import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { createClient, createAdminClient, getAuthedUser } from "@/lib/supabase/server";
import { getSmsProvider } from "@/lib/sms";
import { last4 } from "@/lib/sms/phone";
import { logSms } from "@/lib/notifications/log";

/**
 * Sends a verification code to the phone number already saved via
 * /api/notifications/phone/save. Saving and verifying are separate actions,
 * so this route never re-saves the number — it only reads it.
 */
export async function POST() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("phone_e164, phone_consent_given_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!prefs?.phone_e164) {
    return NextResponse.json({ status: "no_saved_number", message: "Save a phone number before verifying it." });
  }
  if (!prefs.phone_consent_given_at) {
    return NextResponse.json({ status: "consent_required", message: "SMS consent is required before verifying this number." });
  }

  const e164 = prefs.phone_e164;

  // Rate limit: max 3 verification codes per user per 15 minutes.
  const admin = createAdminClient();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await admin
    .from("phone_verifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ status: "rate_limited", message: "Too many verification attempts. Wait 15 minutes and try again." });
  }

  const code = randomInt(100000, 999999).toString();
  const provider = getSmsProvider();
  const result = await provider.send(e164, `Your O'Boyle Acquisition OS verification code is ${code}. It expires in 10 minutes.`);

  if (!result.ok) {
    await logSms(user.id, last4(e164), result.reason === "provider_error" ? "failed" : result.reason, undefined, result.message);
    // The saved number is untouched — a failed/unconfigured send must never
    // erase what was already saved in step 1.
    return NextResponse.json({ status: result.reason, message: result.message });
  }

  const codeHash = createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  await admin.from("phone_verifications").insert({
    user_id: user.id,
    phone_e164: e164,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  await supabase.from("notification_preferences").update({ phone_status: "pending" }).eq("user_id", user.id);
  await logSms(user.id, last4(e164), "sent", result.providerMessageId);

  return NextResponse.json({ status: "sent" });
}
