import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceLabel?: string;
  };

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      device_label: body.deviceLabel ?? null,
      active: true,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, push_enabled: true }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json() as { endpoint?: string };

  if (endpoint) {
    await supabase.from("push_subscriptions").update({ active: false }).eq("user_id", user.id).eq("endpoint", endpoint);
  } else {
    await supabase.from("push_subscriptions").update({ active: false }).eq("user_id", user.id);
  }

  await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, push_enabled: false }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
