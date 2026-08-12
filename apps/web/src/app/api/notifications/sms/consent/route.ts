import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { last4 } from "@/lib/sms/phone";
import { SMS_CONSENT_VERSION, SMS_CONSENT_TEXT } from "@/lib/sms/consent";

/**
 * Gives or withdraws SMS consent for an already-verified number, and logs
 * the change to the audit trail. Separate from /phone/save (which logs the
 * *initial* consent) so withdrawing/restoring consent later is also on
 * the record with its own timestamp.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { enabled } = await req.json() as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ status: "failed", message: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("phone_e164")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("notification_preferences")
    .update({ sms_enabled: enabled, sms_consent_version: SMS_CONSENT_VERSION })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ status: "failed", message: "Could not update consent. Try again." });
  }

  await supabase.from("sms_consent_events").insert({
    user_id: user.id,
    event: enabled ? "given" : "withdrawn",
    consent_version: SMS_CONSENT_VERSION,
    consent_text: SMS_CONSENT_TEXT,
    phone_e164_last4: prefs?.phone_e164 ? last4(prefs.phone_e164) : null,
  });

  return NextResponse.json({ status: "ok", sms_enabled: enabled });
}
