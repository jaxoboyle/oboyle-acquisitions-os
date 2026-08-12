import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompanyVisionClient } from "./CompanyVisionClient";

export default async function CompanyVisionPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const [
    { data: metrics },
    { data: targets },
    { data: milestones },
    { data: storyEntries },
    { data: wins },
    { data: openBlockers },
  ] = await Promise.all([
    supabase
      .from("company_vision_metrics")
      .select("*")
      .eq("user_id", user.id)
      .order("recorded_date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("annual_company_targets")
      .select("*")
      .eq("user_id", user.id)
      .order("target_year", { ascending: true }),

    supabase
      .from("company_vision_milestones")
      .select("*")
      .eq("user_id", user.id)
      .order("stage", { ascending: true })
      .order("display_order", { ascending: true }),

    supabase
      .from("company_story_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .in("entry_type", ["ceo_review", "company_story", "next_milestone"]),

    // Wins are a running log, not a single "current" entry — every row stays.
    supabase
      .from("company_story_entries")
      .select("id, content, created_at")
      .eq("user_id", user.id)
      .eq("entry_type", "major_win")
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("blockers")
      .select("id, description, blocker_type, created_at")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        title="Company Vision"
        description="The 15-year plan toward $100,000,000 in owned or controlled commercial real estate."
      />
      <CompanyVisionClient
        userId={user.id}
        metrics={metrics ?? null}
        targets={targets ?? []}
        milestones={milestones ?? []}
        storyEntries={storyEntries ?? []}
        wins={wins ?? []}
        openBlockers={openBlockers ?? []}
      />
    </div>
  );
}
