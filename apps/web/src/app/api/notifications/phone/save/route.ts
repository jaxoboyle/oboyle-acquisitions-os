import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { toE164, last4 } from "@/lib/sms/phone";
import { SMS_CONSENT_VERSION, SMS_CONSENT_TEXT } from "@/lib/sms/consent";

/**
 * Saves the phone number to the user's notification preferences WITHOUT
 * sending anything through Twilio. Saving and verifying are deliberately
 * separate actions — this route must succeed even when Twilio isn't
 * configured at all, so the number is never lost waiting on a provider call.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { countryCode?: string; phoneNumber?: string; consent?: boolean };

  if (!body.consent) {
    return NextResponse.json({ status: "consent_required", message: "Check the SMS consent box before saving a number." });
  }

  const e164 = body.countryCode && body.phoneNumber ? toE164(body.countryCode, body.phoneNumber) : null;
  if (!e164) {
    return NextResponse.json({ status: "invalid_number", message: "Enter a valid phone number and country code." });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: user.id,
      phone_e164: e164,
      phone_country_code: body.countryCode,
      phone_status: "unverified",
      phone_consent_given_at: new Date().toISOString(),
      sms_consent_version: SMS_CONSENT_VERSION,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ status: "failed", message: "Could not save the phone number. Try again." });
  }

  // Audit trail — who, when, which wording version, and the exact text
  // shown. Required for SMS carrier registration compliance.
  await supabase.from("sms_consent_events").insert({
    user_id: user.id,
    event: "given",
    consent_version: SMS_CONSENT_VERSION,
    consent_text: SMS_CONSENT_TEXT,
    phone_e164_last4: last4(e164),
  });

  return NextResponse.json({ status: "saved", phone_e164: e164 });
}
