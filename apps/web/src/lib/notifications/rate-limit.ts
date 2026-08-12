import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function isRateLimited(
  supabase: SupabaseClient,
  userId: string,
  channel: "push" | "sms",
  maxCount: number,
  windowMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await supabase
    .from("notification_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("channel", channel)
    .gte("created_at", since);
  return (count ?? 0) >= maxCount;
}
