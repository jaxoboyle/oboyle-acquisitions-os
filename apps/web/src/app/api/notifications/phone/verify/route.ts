import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json() as { code?: string };
  if (!code) return NextResponse.json({ status: "invalid_code", message: "Enter the code you received." });

  const admin = createAdminClient();
  const { data: verification } = await admin
    .from("phone_verifications")
    .select("*")
    .eq("user_id", user.id)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!verification) {
    return NextResponse.json({ status: "no_pending_code", message: "No verification code is pending. Request a new one." });
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ status: "expired", message: "That code has expired. Request a new one." });
  }

  if (verification.attempts >= 5) {
    return NextResponse.json({ status: "too_many_attempts", message: "Too many incorrect attempts. Request a new code." });
  }

  const submittedHash = createHash("sha256").update(code).digest("hex");

  await admin
    .from("phone_verifications")
    .update({ attempts: verification.attempts + 1 })
    .eq("id", verification.id);

  if (submittedHash !== verification.code_hash) {
    return NextResponse.json({ status: "invalid_code", message: "That code doesn't match. Try again." });
  }

  await admin
    .from("phone_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", verification.id);

  // Consent was already captured at send-code time; verifying confirms it's
  // really their number, so SMS can now actually be enabled.
  await supabase
    .from("notification_preferences")
    .update({ phone_status: "verified", sms_enabled: true })
    .eq("user_id", user.id);

  return NextResponse.json({ status: "verified" });
}
