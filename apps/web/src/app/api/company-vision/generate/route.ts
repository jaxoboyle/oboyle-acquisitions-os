import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { stageInfo, VISION_TARGET } from "@/lib/company-vision/stages";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseSection(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : "";
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 200 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── Gather real, verified data only — no invented numbers ──────────────
  const [
    { data: metrics },
    { data: targets },
    { data: milestones },
    { data: revenueTarget },
    { data: openBlockers },
    { data: recentWorkdays },
    { data: activeObjectives },
    { count: dealsClosedCount },
    { count: leadsCount },
    { count: activityCount },
  ] = await Promise.all([
    supabase.from("company_vision_metrics").select("*").eq("user_id", user.id).order("recorded_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("annual_company_targets").select("target_year, planned_asset_value, actual_asset_value").eq("user_id", user.id).order("target_year", { ascending: true }),
    supabase.from("company_vision_milestones").select("stage, title, status, target_date").eq("user_id", user.id).order("display_order", { ascending: true }),
    supabase.from("revenue_targets").select("target_main, collected, period_end").eq("user_id", user.id).eq("period_type", "thirty_day").order("period_start", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("blockers").select("description, blocker_type").eq("user_id", user.id).eq("status", "open").limit(10),
    supabase.from("workdays").select("actual_minutes, work_date").eq("user_id", user.id).gte("work_date", thirtyDaysAgo.slice(0, 10)),
    supabase.from("objectives").select("title, progress_pct, level").eq("user_id", user.id).eq("status", "in_progress").is("deleted_at", null).limit(5),
    supabase.from("deals").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("closing_status", "closed"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
    supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", thirtyDaysAgo),
  ]);

  const stage = stageInfo(metrics?.current_stage ?? 1);
  const nextMilestone = (milestones ?? []).find((m) => m.status === "planned" || m.status === "in_progress");
  const hoursWorked30d = (recentWorkdays ?? []).reduce((sum, w) => sum + (w.actual_minutes ?? 0), 0) / 60;
  const daysWorked30d = (recentWorkdays ?? []).filter((w) => (w.actual_minutes ?? 0) > 0).length;

  const dataSummary = `
VERIFIED COMPANY METRICS (most recently entered by the user — treat as ground truth, do not alter):
- Owned/controlled asset value: $${(metrics?.owned_asset_value ?? 0).toLocaleString()}
- Estimated equity: $${(metrics?.estimated_equity ?? 0).toLocaleString()}
- Annual revenue: $${(metrics?.annual_revenue ?? 0).toLocaleString()}
- Cash reserves: $${(metrics?.cash_reserves ?? 0).toLocaleString()}
- Acquisitions completed: ${metrics?.acquisitions_completed ?? 0}
- Shopping centers owned: ${metrics?.shopping_centers_owned ?? 0}
- Strip centers owned: ${metrics?.strip_centers_owned ?? 0}
- Multifamily units owned: ${metrics?.multifamily_units_owned ?? 0}
- Commercial sq ft controlled: ${metrics?.commercial_sqft_controlled ?? 0}
- 15-year target: $${VISION_TARGET.toLocaleString()}
- Current stage: Stage ${stage.stage} — ${stage.name}

15-YEAR PLAN (planned vs actual, where entered):
${(targets ?? []).map((t) => `- ${t.target_year}: planned $${t.planned_asset_value.toLocaleString()}, actual ${t.actual_asset_value != null ? "$" + t.actual_asset_value.toLocaleString() : "not yet recorded"}`).join("\n") || "- No annual targets recorded yet."}

CURRENT 30-DAY WHOLESALE REVENUE CYCLE:
- Target: $${revenueTarget?.target_main ?? "not set"}
- Collected: $${revenueTarget?.collected ?? 0}

CRM SNAPSHOT:
- Total leads on file: ${leadsCount ?? 0}
- Deals closed to date: ${dealsClosedCount ?? 0}
- CRM activity logged in the last 30 days: ${activityCount ?? 0} entries

TIME WORKED (last 30 days):
- Days with logged work: ${daysWorked30d}
- Total hours logged: ${hoursWorked30d.toFixed(1)}

ACTIVE OBJECTIVES:
${(activeObjectives ?? []).map((o) => `- ${o.title} (${o.progress_pct}% complete)`).join("\n") || "- None currently in progress."}

OPEN BLOCKERS (current obstacles):
${(openBlockers ?? []).map((b) => `- ${b.description}${b.blocker_type ? ` (${b.blocker_type})` : ""}`).join("\n") || "- None recorded."}

NEXT PLANNED MILESTONE:
${nextMilestone ? `- Stage ${nextMilestone.stage}: ${nextMilestone.title}${nextMilestone.target_date ? ` (target ${nextMilestone.target_date})` : ""}` : "- No upcoming milestone has been recorded yet."}
`.trim();

  // A category counts as "missing" when it's genuinely empty, not just small —
  // Big Stein is instructed below to name these explicitly rather than paper
  // over them with generic language.
  const missingCategories: string[] = [];
  if (!metrics) missingCategories.push("verified asset/equity/revenue metrics (none entered yet)");
  if (!targets || targets.length === 0) missingCategories.push("the 15-year planned-value timeline");
  if (!milestones || milestones.length === 0) missingCategories.push("any recorded milestones");
  if (daysWorked30d === 0) missingCategories.push("time-tracking data for the last 30 days");
  if (!activeObjectives || activeObjectives.length === 0) missingCategories.push("an active objective");
  if ((leadsCount ?? 0) === 0 && (dealsClosedCount ?? 0) === 0) missingCategories.push("CRM lead/deal history");

  const prompt = `You are Big Stein, CEO and strategic operator of O'Boyle Acquisitions, writing the Company Vision page content. The company's 15-year goal is $100,000,000 in owned/controlled commercial real estate assets, built through six stages (currently Stage ${stage.stage}: ${stage.name}).

Ground every sentence in the data below. Do not invent numbers, deals, or activity that isn't listed. Do not claim any future milestone is complete. Do not fill gaps with generic motivational language.

${dataSummary}

DATA GAPS DETECTED — you must name these explicitly wherever they're relevant to what you're writing, rather than writing around them:
${missingCategories.length > 0 ? missingCategories.map((m) => `- Missing: ${m}`).join("\n") : "- None — every category above has real data."}

Write three sections, each wrapped in its own XML tag, nothing else outside the tags:

<ceo_review>
A direct, honest CEO review (150-250 words) of where the company actually stands against the $100M / 15-year plan right now. Reference the real numbers above — asset value, revenue, time worked, deals, objectives, blockers. Name the gap plainly. If a data gap above limits what you can honestly assess, say exactly what's missing and what recording it would let you evaluate.
</ceo_review>

<company_story>
The long-term story of the company so far (120-200 words) — where it started, what's been proven, what stage it's in now. Grounded only in the data given; if there isn't much history yet, say this is early and name what the first real proof points were.
</company_story>

<next_milestone>
A short, concrete note (60-120 words) on the next milestone from the data above and what specifically needs to happen to hit it. If no milestone is recorded, say that plainly and recommend recording one instead of inventing one.
</next_milestone>`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  let responseText = "";
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    responseText = message.content
      .map((b) => ("text" in b ? b.text : ""))
      .join("\n");
  } catch (err) {
    const apiErr = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: `Big Stein is temporarily unavailable (${apiErr.status ?? "error"}): ${apiErr.message ?? "unknown error"}` },
      { status: 200 }
    );
  }

  const sections = [
    { type: "ceo_review" as const, content: parseSection(responseText, "ceo_review") },
    { type: "company_story" as const, content: parseSection(responseText, "company_story") },
    { type: "next_milestone" as const, content: parseSection(responseText, "next_milestone") },
  ].filter((s) => s.content.length > 0);

  if (sections.length === 0) {
    return NextResponse.json({ error: "Big Stein's response could not be parsed. Try again." }, { status: 200 });
  }

  for (const section of sections) {
    await supabase.from("company_story_entries").update({ is_current: false }).eq("user_id", user.id).eq("entry_type", section.type).eq("is_current", true);
    await supabase.from("company_story_entries").insert({
      user_id: user.id,
      entry_type: section.type,
      content: section.content,
      generated_by: "big_stein",
      is_current: true,
    });
  }

  return NextResponse.json({ ok: true, sections });
}
