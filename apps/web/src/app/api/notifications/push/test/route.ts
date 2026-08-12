import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPushConfigured, sendPushToSubscription } from "@/lib/push/send";
import { logDelivery } from "@/lib/notifications/log";
import { isRateLimited } from "@/lib/notifications/rate-limit";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPushConfigured()) {
    return NextResponse.json({
      status: "not_configured",
      message: "VAPID configuration missing on the server (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).",
    });
  }

  if (await isRateLimited(supabase, user.id, "push", 3, 10)) {
    await logDelivery(user.id, "push", "test", "rate_limited");
    return NextResponse.json({ status: "rate_limited", message: "Too many test notifications sent. Wait a few minutes and try again." });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ status: "no_subscription", message: "No active push subscription. Enable browser push notifications first." });
  }

  let sentAny = false;
  let lastError = "";

  for (const sub of subs) {
    try {
      await sendPushToSubscription(sub, {
        title: "O'Boyle Acquisition OS",
        body: "Test notification from Big Stein — push notifications are working.",
        url: "/dashboard",
      });
      sentAny = true;
    } catch (err) {
      const pushErr = err as { statusCode?: number; message?: string };
      lastError = pushErr.message ?? "Unknown push error";
      if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
        await supabase.from("push_subscriptions").update({ active: false }).eq("id", sub.id);
      }
    }
  }

  await logDelivery(user.id, "push", "test", sentAny ? "sent" : "failed", sentAny ? undefined : lastError);

  return sentAny
    ? NextResponse.json({ status: "sent" })
    : NextResponse.json({ status: "failed", message: lastError || "Push send failed." });
}
