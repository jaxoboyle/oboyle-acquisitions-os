"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { STAGES, VISION_TARGET, stageInfo } from "@/lib/company-vision/stages";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Landmark, Loader2, Sparkles, AlertTriangle, Flag, Settings2, TrendingUp } from "lucide-react";

type Metrics = {
  id: string;
  recorded_date: string;
  owned_asset_value: number;
  estimated_equity: number;
  annual_revenue: number;
  cash_reserves: number;
  acquisitions_completed: number;
  shopping_centers_owned: number;
  strip_centers_owned: number;
  multifamily_units_owned: number;
  commercial_sqft_controlled: number;
  current_stage: number;
} | null;

type Target = {
  id: string;
  target_year: number;
  planned_asset_value: number;
  actual_asset_value: number | null;
};

type Milestone = {
  id: string;
  stage: number;
  title: string;
  description: string | null;
  target_date: string | null;
  status: "planned" | "in_progress" | "completed" | "missed";
  is_turning_point: boolean;
  display_order: number;
};

type StoryEntry = {
  id: string;
  entry_type: "ceo_review" | "company_story" | "next_milestone";
  content: string;
  created_at: string;
};

type Blocker = {
  id: string;
  description: string;
  blocker_type: string | null;
  created_at: string;
};

type Win = {
  id: string;
  content: string;
  created_at: string;
};

// Cumulative share of (target - starting value) unlocked by the end of each
// year, banded to the five stated growth phases so the curve visibly steps
// up at each stage transition instead of following one smooth exponential.
// Sums to 100. This is a PLAN, not a forecast — every year stays editable.
const STAGE_BAND_WEIGHTS = [
  1, 2, // Years 1-2 — wholesaling, relationships, capital
  3, 4, 5, // Years 3-5 — repeatable acquisitions, small commercial
  6, 7, 8, 9, // Years 6-9 — strip centers, service retail, partnerships
  11, 12, 13, // Years 10-12 — larger shopping centers, mixed-use, multifamily
  6, 6, 7, // Years 13-15 — institutional-quality portfolio
];

function stagedPlan(startValue: number, targetValue: number): number[] {
  const total = STAGE_BAND_WEIGHTS.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  return STAGE_BAND_WEIGHTS.map((w) => {
    cumulative += w;
    return Math.round(startValue + (targetValue - startValue) * (cumulative / total));
  });
}

export function CompanyVisionClient({
  userId,
  metrics,
  targets,
  milestones,
  storyEntries,
  wins,
  openBlockers,
}: {
  userId: string;
  metrics: Metrics;
  targets: Target[];
  milestones: Milestone[];
  storyEntries: StoryEntry[];
  wins: Win[];
  openBlockers: Blocker[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showMetricsForm, setShowMetricsForm] = useState(false);
  const [seedingPlan, setSeedingPlan] = useState(false);

  const ownedValue = metrics?.owned_asset_value ?? 0;
  const pct = Math.min((ownedValue / VISION_TARGET) * 100, 100);
  const remaining = Math.max(VISION_TARGET - ownedValue, 0);
  const stage = stageInfo(metrics?.current_stage ?? 1);

  const ceoReview = storyEntries.find((e) => e.entry_type === "ceo_review");
  const companyStory = storyEntries.find((e) => e.entry_type === "company_story");
  const nextMilestoneNarrative = storyEntries.find((e) => e.entry_type === "next_milestone");
  // Deliberately re-sorted by display_order alone (not the stage-grouped
  // order the page fetched in) so "Set as next" can promote a milestone
  // from any stage to the front, independent of how the list below groups.
  const nextStructuralMilestone = [...milestones]
    .filter((m) => m.status === "planned" || m.status === "in_progress")
    .sort((a, b) => a.display_order - b.display_order)[0];
  const turningPoints = milestones.filter((m) => m.is_turning_point);
  const futureMilestones = milestones.filter((m) => m.status !== "completed");
  const minDisplayOrder = milestones.length ? Math.min(...milestones.map((m) => m.display_order)) : 0;

  async function generateReview() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/company-vision/generate", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setGenerateError(data.error);
      } else {
        router.refresh();
      }
    } catch {
      setGenerateError("Could not reach Big Stein. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function seedDefaultPlan() {
    setSeedingPlan(true);
    const supabase = createClient();
    const startYear = new Date().getFullYear();
    const planned = stagedPlan(ownedValue, VISION_TARGET);
    const rows = planned.map((value, i) => ({
      user_id: userId,
      target_year: startYear + i,
      planned_asset_value: value,
    }));
    await supabase.from("annual_company_targets").upsert(rows, { onConflict: "user_id,target_year" });
    setSeedingPlan(false);
    router.refresh();
  }

  async function setAsNextMilestone(milestoneId: string) {
    const supabase = createClient();
    await supabase
      .from("company_vision_milestones")
      .update({ display_order: minDisplayOrder - 1 })
      .eq("id", milestoneId);
    router.refresh();
  }

  async function resolveObstacle(blockerId: string) {
    const supabase = createClient();
    await supabase
      .from("blockers")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", blockerId);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ── Main progress ────────────────────────────────────────────────── */}
      <section className="card p-6 texture-grid">
        <div className="flex items-center gap-2 mb-5">
          <Landmark size={16} className="text-accent" />
          <h2 className="label-tech">$0 → $100,000,000</h2>
        </div>
        <ProgressBar value={pct} variant="accent" className="h-3 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Stat label="Current Verified Value" value={formatCurrency(ownedValue)} accent />
          <Stat label="Remaining" value={formatCurrency(remaining)} />
          <Stat label="Percent Complete" value={`${pct.toFixed(2)}%`} />
        </div>
        {!metrics && (
          <p className="text-xs text-text-subtle mt-4">
            No verified metrics recorded yet. Enter your current numbers below to start tracking.
          </p>
        )}
      </section>

      {/* ── Current stage ────────────────────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="label-tech mb-3">Current Business Stage</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-serif font-semibold text-text">Stage {stage.stage} — {stage.name}</p>
            <p className="text-sm text-text-muted mt-1">{stage.description}</p>
          </div>
          <Badge variant="brand">Stage {stage.stage} / 6</Badge>
        </div>
      </section>

      {/* ── Planned vs actual ────────────────────────────────────────────── */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="label-tech">15-Year Timeline — Planned vs. Actual</h2>
          <div className="flex items-center gap-3 text-[11px] text-text-subtle">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-brand inline-block" /> Planned</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent inline-block" /> Actual</span>
          </div>
        </div>

        {targets.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No 15-year plan recorded"
            description="Generate a default planned-value curve (editable anytime) to see the full timeline, or enter each year manually below."
            action={undefined}
          />
        ) : (
          <div className="flex items-end gap-2.5 overflow-x-auto pb-2" style={{ height: 180 }}>
            {targets.map((t) => {
              const plannedH = Math.max(4, (t.planned_asset_value / VISION_TARGET) * 150);
              const actualH = t.actual_asset_value != null ? Math.max(2, (t.actual_asset_value / VISION_TARGET) * 150) : 0;
              return (
                <div key={t.id} className="flex flex-col items-center shrink-0 w-11">
                  <div className="flex items-end gap-1" style={{ height: 150 }}>
                    <div className="w-4 bg-brand rounded-t-sm" style={{ height: plannedH }} title={`Planned: ${formatCurrency(t.planned_asset_value)}`} />
                    <div className="w-4 bg-accent rounded-t-sm" style={{ height: actualH }} title={t.actual_asset_value != null ? `Actual: ${formatCurrency(t.actual_asset_value)}` : "No actual recorded"} />
                  </div>
                  <span className="label-tech mt-1.5">{t.target_year}</span>
                </div>
              );
            })}
          </div>
        )}

        {targets.length === 0 && (
          <button onClick={seedDefaultPlan} disabled={seedingPlan} className="btn-secondary text-sm mt-4">
            {seedingPlan ? <Loader2 size={14} className="animate-spin" /> : "Generate Default 15-Year Plan"}
          </button>
        )}
      </section>

      {/* ── Timeline table ───────────────────────────────────────────────── */}
      {targets.length > 0 && (
        <section className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6 pb-3">
            <h2 className="label-tech">Year-by-Year Detail</h2>
            <span className="text-[11px] text-text-subtle">Planned is a plan, not a guarantee — edit any year</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr><th>Year</th><th>Planned</th><th>Actual</th><th>Variance</th></tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <TargetRow key={t.id} target={t} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Big Stein's CEO Review ───────────────────────────────────────── */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="label-tech">Big Stein&apos;s CEO Review</h2>
          <button onClick={generateReview} disabled={generating} className="btn-secondary text-xs flex items-center gap-1.5">
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {ceoReview ? "Regenerate" : "Generate Review"}
          </button>
        </div>
        {generateError && <p className="text-xs text-danger mb-3">{generateError}</p>}
        {ceoReview ? (
          <>
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{ceoReview.content}</p>
            <p className="text-[11px] text-text-subtle mt-3">{formatDate(ceoReview.created_at)}</p>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            No review yet. Big Stein will write one grounded in your recorded metrics and CRM data.
          </p>
        )}
      </section>

      {/* ── Company story ────────────────────────────────────────────────── */}
      <CompanyStorySection userId={userId} companyStory={companyStory} />

      {/* ── Turning points + obstacles + next milestone ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WinsAndTurningPointsCard userId={userId} wins={wins} turningPoints={turningPoints} />
        <ObstaclesCard userId={userId} openBlockers={openBlockers} onResolve={resolveObstacle} />

        <section className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-brand" />
            <h2 className="text-sm font-semibold text-text">Next Milestone</h2>
          </div>
          {nextStructuralMilestone ? (
            <p className="text-sm text-text font-medium">{nextStructuralMilestone.title}</p>
          ) : (
            <p className="text-xs text-text-muted mb-2">No milestone recorded yet.</p>
          )}
          {nextMilestoneNarrative && (
            <p className="text-xs text-text-muted mt-2 leading-relaxed">{nextMilestoneNarrative.content}</p>
          )}
        </section>
      </div>

      {/* ── Future milestones ────────────────────────────────────────────── */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="label-tech">Future Milestones</h2>
          <AddMilestoneButton userId={userId} currentStage={stage.stage} />
        </div>
        {futureMilestones.length === 0 ? (
          <p className="text-sm text-text-muted">No milestones recorded yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {futureMilestones.map((m) => (
              <li key={m.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-text">
                    {m.title}
                    {m.is_turning_point && <Flag size={11} className="inline ml-1.5 mb-0.5 text-accent" />}
                  </p>
                  <span className="label-tech">Stage {m.stage}{m.target_date ? ` · ${formatDate(m.target_date)}` : ""}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {nextStructuralMilestone?.id !== m.id && m.status !== "completed" && (
                    <button
                      onClick={() => setAsNextMilestone(m.id)}
                      className="text-[11px] text-brand hover:underline"
                    >
                      Set as next
                    </button>
                  )}
                  <Badge variant={m.status === "in_progress" ? "brand" : "neutral"}>{m.status.replace("_", " ")}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── The six stages ───────────────────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="label-tech mb-4">Why Each Stage Matters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STAGES.map((s) => (
            <div
              key={s.stage}
              className={cn(
                "p-4 rounded border",
                s.stage === stage.stage ? "border-accent bg-accent-muted" : "border-surface-border"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-serif font-semibold text-text">Stage {s.stage}</span>
                {s.stage === stage.stage && <Badge variant="accent">Current</Badge>}
              </div>
              <p className="text-sm text-text mb-1.5">{s.name}</p>
              <p className="text-xs text-text-muted">{s.whyItMatters}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Manual metrics entry ─────────────────────────────────────────── */}
      <section className="card p-6">
        <button
          onClick={() => setShowMetricsForm((v) => !v)}
          className="flex items-center gap-2 label-tech hover:text-text transition-colors"
        >
          <Settings2 size={13} />
          {showMetricsForm ? "Hide metrics entry" : "Update Verified Metrics"}
        </button>
        {showMetricsForm && <MetricsForm userId={userId} metrics={metrics} />}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="label-tech">{label}</div>
      <div className={cn("num text-2xl mt-1", accent ? "text-accent" : "text-text")}>{value}</div>
    </div>
  );
}

function TargetRow({ target }: { target: Target }) {
  const router = useRouter();
  const [planned, setPlanned] = useState(target.planned_asset_value);
  const [actual, setActual] = useState(target.actual_asset_value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("annual_company_targets")
      .update({
        planned_asset_value: planned,
        actual_asset_value: actual === "" ? null : Number(actual),
      })
      .eq("id", target.id);
    setSaving(false);
    router.refresh();
  }

  const variance = actual !== "" ? Number(actual) - planned : null;

  return (
    <tr>
      <td className="num">{target.target_year}</td>
      <td>
        <input
          type="number"
          min={0}
          className="input num w-32 text-sm"
          value={planned}
          onChange={(e) => setPlanned(Number(e.target.value))}
          onBlur={save}
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          placeholder="Not recorded"
          className="input num w-32 text-sm"
          value={actual}
          onChange={(e) => setActual(e.target.value === "" ? "" : Number(e.target.value))}
          onBlur={save}
        />
      </td>
      <td className={cn("num", variance != null && (variance >= 0 ? "text-success" : "text-danger"))}>
        {variance != null ? `${variance >= 0 ? "+" : ""}${formatCurrency(variance)}` : "—"}
        {saving && <Loader2 size={11} className="inline animate-spin ml-1.5 text-text-subtle" />}
      </td>
    </tr>
  );
}

function CompanyStorySection({ userId, companyStory }: { userId: string; companyStory: StoryEntry | undefined }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(companyStory?.content ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("company_story_entries")
      .update({ is_current: false })
      .eq("user_id", userId)
      .eq("entry_type", "company_story")
      .eq("is_current", true);
    await supabase.from("company_story_entries").insert({
      user_id: userId,
      entry_type: "company_story",
      content: draft.trim(),
      generated_by: "user",
      is_current: true,
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="label-tech">The Company&apos;s Long-Term Story</h2>
        <button onClick={() => setEditing((v) => !v)} className="text-xs text-brand hover:underline">
          {editing ? "Cancel" : companyStory ? "Edit" : "Write it"}
        </button>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="input text-sm w-full min-h-[120px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Where the company started, what's been proven, what stage it's in now…"
          />
          <button onClick={save} disabled={saving || !draft.trim()} className="btn-primary text-sm">
            {saving ? "Saving…" : "Save Story"}
          </button>
        </div>
      ) : companyStory ? (
        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{companyStory.content}</p>
      ) : (
        <p className="text-sm text-text-muted">Not written yet — generate a CEO review above, or write it yourself.</p>
      )}
    </section>
  );
}

function WinsAndTurningPointsCard({
  userId,
  wins,
  turningPoints,
}: {
  userId: string;
  wins: Win[];
  turningPoints: Milestone[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function recordWin() {
    if (!draft.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("company_story_entries").insert({
      user_id: userId,
      entry_type: "major_win",
      content: draft.trim(),
      generated_by: "user",
      is_current: true,
    });
    setSaving(false);
    setDraft("");
    setAdding(false);
    router.refresh();
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flag size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-text">Major Wins & Turning Points</h2>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="text-[11px] text-brand hover:underline shrink-0">
          {adding ? "Cancel" : "Record a win"}
        </button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2">
          <textarea
            className="input text-xs w-full min-h-[60px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Closed the first six-figure assignment fee"
          />
          <button onClick={recordWin} disabled={saving || !draft.trim()} className="btn-primary text-xs">
            {saving ? "Saving…" : "Save Win"}
          </button>
        </div>
      )}

      {turningPoints.length === 0 && wins.length === 0 ? (
        <p className="text-xs text-text-muted">None recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {turningPoints.map((m) => (
            <li key={m.id} className="text-sm text-text flex items-center gap-1.5">
              <Flag size={11} className="text-accent shrink-0" /> {m.title}
            </li>
          ))}
          {wins.map((w) => (
            <li key={w.id} className="text-sm text-text">{w.content}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ObstaclesCard({
  userId,
  openBlockers,
  onResolve,
}: {
  userId: string;
  openBlockers: Blocker[];
  onResolve: (id: string) => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function recordObstacle() {
    if (!draft.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("blockers").insert({
      user_id: userId,
      description: draft.trim(),
      status: "open",
    });
    setSaving(false);
    setDraft("");
    setAdding(false);
    router.refresh();
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning" />
          <h2 className="text-sm font-semibold text-text">Current Obstacles</h2>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="text-[11px] text-brand hover:underline shrink-0">
          {adding ? "Cancel" : "Add"}
        </button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2">
          <textarea
            className="input text-xs w-full min-h-[60px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's currently blocking progress?"
          />
          <button onClick={recordObstacle} disabled={saving || !draft.trim()} className="btn-primary text-xs">
            {saving ? "Saving…" : "Save Obstacle"}
          </button>
        </div>
      )}

      {openBlockers.length === 0 ? (
        <p className="text-xs text-text-muted">No open blockers recorded.</p>
      ) : (
        <ul className="space-y-2">
          {openBlockers.map((b) => (
            <li key={b.id} className="text-sm text-text flex items-center justify-between gap-2">
              <span>{b.description}</span>
              <button onClick={() => onResolve(b.id)} className="text-[11px] text-success hover:underline shrink-0">
                Resolve
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddMilestoneButton({ userId, currentStage }: { userId: string; currentStage: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    stage: currentStage,
    target_date: "",
    is_turning_point: false,
  });

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("company_vision_milestones").insert({
      user_id: userId,
      stage: form.stage,
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_date: form.target_date || null,
      is_turning_point: form.is_turning_point,
      status: "planned",
      display_order: Date.now(),
    });
    setSaving(false);
    setOpen(false);
    setForm({ title: "", description: "", stage: currentStage, target_date: "", is_turning_point: false });
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-brand hover:underline">
        Add Milestone
      </button>
    );
  }

  return (
    <div className="w-full mt-3 space-y-2 border border-surface-border rounded p-3">
      <input
        className="input text-sm w-full"
        placeholder="Milestone title"
        value={form.title}
        onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
      />
      <textarea
        className="input text-sm w-full min-h-[50px]"
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input text-sm"
          value={form.stage}
          onChange={(e) => setForm((s) => ({ ...s, stage: Number(e.target.value) }))}
        >
          {STAGES.map((s) => (
            <option key={s.stage} value={s.stage}>Stage {s.stage}</option>
          ))}
        </select>
        <input
          type="date"
          className="input text-sm"
          value={form.target_date}
          onChange={(e) => setForm((s) => ({ ...s, target_date: e.target.value }))}
        />
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={form.is_turning_point}
            onChange={(e) => setForm((s) => ({ ...s, is_turning_point: e.target.checked }))}
          />
          Turning point
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving || !form.title.trim()} className="btn-primary text-sm">
          {saving ? "Saving…" : "Save Milestone"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}

function MetricsForm({ userId, metrics }: { userId: string; metrics: Metrics }) {
  const router = useRouter();
  const [form, setForm] = useState({
    owned_asset_value: metrics?.owned_asset_value ?? 0,
    estimated_equity: metrics?.estimated_equity ?? 0,
    annual_revenue: metrics?.annual_revenue ?? 0,
    cash_reserves: metrics?.cash_reserves ?? 0,
    acquisitions_completed: metrics?.acquisitions_completed ?? 0,
    shopping_centers_owned: metrics?.shopping_centers_owned ?? 0,
    strip_centers_owned: metrics?.strip_centers_owned ?? 0,
    multifamily_units_owned: metrics?.multifamily_units_owned ?? 0,
    commercial_sqft_controlled: metrics?.commercial_sqft_controlled ?? 0,
    current_stage: metrics?.current_stage ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("company_vision_metrics").insert({ user_id: userId, entered_by: "user", ...form });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  const fields: Array<{ key: keyof typeof form; label: string; money?: boolean }> = [
    { key: "owned_asset_value", label: "Owned/controlled asset value", money: true },
    { key: "estimated_equity", label: "Estimated equity", money: true },
    { key: "annual_revenue", label: "Annual revenue", money: true },
    { key: "cash_reserves", label: "Cash reserves", money: true },
    { key: "acquisitions_completed", label: "Acquisitions completed" },
    { key: "shopping_centers_owned", label: "Shopping centers owned" },
    { key: "strip_centers_owned", label: "Strip centers owned" },
    { key: "multifamily_units_owned", label: "Multifamily units owned" },
    { key: "commercial_sqft_controlled", label: "Commercial sq ft controlled" },
  ];

  return (
    <form onSubmit={save} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-text-muted mb-1">{f.label}</label>
            <input
              type="number"
              min={0}
              className="input num"
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: Number(e.target.value) }))}
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Current stage</label>
          <select
            className="input"
            value={form.current_stage}
            onChange={(e) => setForm((s) => ({ ...s, current_stage: Number(e.target.value) }))}
          >
            {STAGES.map((s) => (
              <option key={s.stage} value={s.stage}>Stage {s.stage} — {s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? "Saving…" : "Record Verified Metrics"}
        </button>
        {saved && !saving && <span className="text-xs text-success">Saved — new snapshot recorded.</span>}
      </div>
      <p className="text-[11px] text-text-subtle">
        Each save records a new dated snapshot — nothing is overwritten, so this stays an audit trail.
      </p>
    </form>
  );
}
