"use client";

import Link from "next/link";
import { MessageSquare, Target, AlertTriangle, DollarSign, CheckCircle2, Circle, ChevronRight, Activity } from "lucide-react";
import { formatCurrency, formatDate, formatMinutes, formatRelative, clamp } from "@/lib/utils";
import { WatchPanel } from "@/components/watch/WatchPanel";

type Props = {
  greeting: string;
  settings: { company_name: string; thirty_day_revenue_target: number } | null;
  revenueTarget: {
    target_main: number;
    collected: number;
    closed_awaiting_collection: number;
    contracted_awaiting_closing: number;
    projected_pipeline: number;
    period_end: string;
  } | null;
  todayWorkday: {
    id: string;
    work_date: string;
    clocked_in_at: string | null;
    clocked_out_at: string | null;
    target_minutes: number;
    actual_minutes: number;
  } | null;
  recentActivity: Array<{
    id: string;
    activity_type: string;
    description: string;
    created_at: string;
    leads: { seller_name: string } | { seller_name: string }[] | null;
  }>;
  overdueTasks: Array<{
    id: string;
    title: string;
    due_date: string | null;
    status: string;
    priority: string | null;
    is_revenue_producing: boolean;
  }>;
  todayTasks: Array<{
    id: string;
    title: string;
    status: string;
    is_non_negotiable: boolean;
    estimated_minutes: number | null;
    is_revenue_producing: boolean;
  }>;
  activeDeals: Array<{
    id: string;
    assignment_fee: number | null;
    closing_status: string;
    closing_date: string | null;
    lead_id: string;
  }>;
  currentObjective: {
    id: string;
    title: string;
    progress_pct: number;
    end_date: string | null;
    status: string;
  } | null;
};

export function DashboardClient({
  greeting,
  settings,
  revenueTarget,
  todayWorkday,
  recentActivity,
  overdueTasks,
  todayTasks,
  activeDeals,
  currentObjective,
}: Props) {
  const target = revenueTarget?.target_main ?? settings?.thirty_day_revenue_target ?? 10000;
  const collected = revenueTarget?.collected ?? 0;
  const contracted = revenueTarget?.contracted_awaiting_closing ?? 0;
  const pipeline = revenueTarget?.projected_pipeline ?? 0;
  const periodEnd = revenueTarget?.period_end;

  const collectedPct = clamp((collected / target) * 100, 0, 100);
  const contractedPct = clamp((contracted / target) * 100, 0, 100 - collectedPct);
  const remaining = Math.max(target - collected, 0);

  const daysRemaining = periodEnd
    ? Math.max(
        0,
        Math.ceil(
          (new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const requiredWeeklyPace =
    daysRemaining != null && daysRemaining > 0
      ? (remaining / daysRemaining) * 7
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header greeting ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-semibold text-text">{greeting}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {settings?.company_name ?? "O'Boyle Acquisition Operating System"}
          </p>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-2 btn-primary shrink-0"
        >
          <MessageSquare size={15} />
          Text Big Stein
        </Link>
      </div>

      {/* ── Company pulse — hours, non-negotiables, deals, revenue ────────── */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-surface-border">
          <PulseStat
            label="Hours Today"
            value={formatMinutes(todayWorkday?.actual_minutes ?? 0)}
            sub={`of ${formatMinutes(todayWorkday?.target_minutes ?? 600)} target`}
          />
          <PulseStat
            label="Non-Negotiables"
            value={`${todayTasks.filter((t) => t.status === "completed").length}/${todayTasks.length}`}
            sub="completed today"
          />
          <PulseStat
            label="Active Deals"
            value={String(activeDeals.length)}
            sub="in motion"
          />
          <PulseStat
            label="Collected"
            value={formatCurrency(collected)}
            sub="this period"
            accent
          />
        </div>
      </div>

      {/* ── Top row: Watch + Revenue ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Interactive watch — clock-in, task timer, daily progress */}
        <div className="card p-5 flex items-center justify-center">
          <WatchPanel size="sm" />
        </div>

        {/* Revenue progress — ledger-style, brass for financial figures */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text">30-Day Goal</h2>
            </div>
            <span className="text-xs text-text-muted">
              {daysRemaining != null ? `${daysRemaining}d left` : "—"}
            </span>
          </div>

          {/* Progress bar — stacked, antique brass for collected/contracted */}
          <div className="h-2.5 bg-bg-muted rounded-full overflow-hidden mb-3 flex">
            {/* Collected (solid brass) */}
            <div
              className="bg-accent h-full transition-all"
              style={{ width: `${collectedPct}%` }}
            />
            {/* Contracted (muted brass) */}
            <div
              className="bg-accent/40 h-full transition-all"
              style={{ width: `${contractedPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-text-muted">Target</span>
              <p className="font-serif font-semibold text-text">{formatCurrency(target)}</p>
            </div>
            <div>
              <span className="text-text-muted">Collected</span>
              <p className="font-serif font-semibold text-accent">{formatCurrency(collected)}</p>
            </div>
            <div>
              <span className="text-text-muted">Contracted</span>
              <p className="font-serif font-medium text-text">{formatCurrency(contracted)}</p>
            </div>
            <div>
              <span className="text-text-muted">Pipeline</span>
              <p className="font-serif font-medium text-text-muted">{formatCurrency(pipeline)}</p>
              <span className="text-[10px] text-text-subtle">(not earned)</span>
            </div>
            <div>
              <span className="text-text-muted">Gap</span>
              <p className="font-serif font-semibold text-warning">{formatCurrency(remaining)}</p>
            </div>
            {requiredWeeklyPace != null && (
              <div>
                <span className="text-text-muted">Needed/week</span>
                <p className="font-serif font-medium text-text">{formatCurrency(requiredWeeklyPace)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Today's non-negotiable outcomes ─────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-brand" />
            <h2 className="text-sm font-semibold text-text">Today&apos;s Non-Negotiables</h2>
          </div>
          <Link href="/today" className="text-xs text-brand hover:underline">
            View today
          </Link>
        </div>

        {todayTasks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-muted">No outcomes planned yet.</p>
            <Link href="/today" className="text-xs text-brand hover:underline mt-1 inline-block">
              Plan today →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-start gap-3">
                {task.status === "completed" ? (
                  <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
                ) : (
                  <Circle size={16} className="text-text-subtle mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm truncate ${task.status === "completed" ? "line-through text-text-muted" : "text-text"}`}>
                    {task.title}
                  </p>
                  {task.estimated_minutes && (
                    <p className="text-[11px] text-text-subtle">
                      {formatMinutes(task.estimated_minutes)}
                      {task.is_revenue_producing && (
                        <span className="ml-1 text-accent">• Revenue</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom row: Overdue + Active deals + Objective ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Overdue tasks */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-warning" />
            <h2 className="text-sm font-semibold text-text">
              Overdue
              {overdueTasks.length > 0 && (
                <span className="ml-1.5 badge bg-warning/15 text-warning">
                  {overdueTasks.length}
                </span>
              )}
            </h2>
          </div>
          {overdueTasks.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Nothing overdue.</p>
          ) : (
            <div className="space-y-2">
              {overdueTasks.map((task) => (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="flex items-center gap-2 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text group-hover:text-brand truncate">
                      {task.title}
                    </p>
                    {task.due_date && (
                      <p className="text-[11px] text-danger">{formatDate(task.due_date)}</p>
                    )}
                  </div>
                  <ChevronRight size={13} className="text-text-subtle shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active deals */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={15} className="text-accent" />
              <h2 className="text-sm font-semibold text-text">Active Deals</h2>
            </div>
            <Link href="/deals" className="text-xs text-brand hover:underline">All</Link>
          </div>
          {activeDeals.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">No active deals.</p>
          ) : (
            <div className="space-y-2">
              {activeDeals.map((deal) => (
                <div key={deal.id} className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-medium text-text capitalize">
                      {deal.closing_status.replace("_", " ")}
                    </p>
                    {deal.closing_date && (
                      <p className="text-[11px] text-text-muted">{formatDate(deal.closing_date)}</p>
                    )}
                  </div>
                  <span className="text-sm font-serif font-semibold text-accent">
                    {formatCurrency(deal.assignment_fee)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current objective */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target size={15} className="text-brand" />
            <h2 className="text-sm font-semibold text-text">Monthly Objective</h2>
          </div>
          {!currentObjective ? (
            <div className="text-center py-4">
              <p className="text-sm text-text-muted">No active objective.</p>
              <Link href="/objectives" className="text-xs text-brand hover:underline mt-1 inline-block">
                Create one →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm font-serif text-text font-medium line-clamp-2 mb-3">
                {currentObjective.title}
              </p>
              <div className="h-1.5 bg-bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${currentObjective.progress_pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-muted">
                <span>{currentObjective.progress_pct}% complete</span>
                {currentObjective.end_date && (
                  <span>Due {formatDate(currentObjective.end_date)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent activity feed ──────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={15} className="text-brand" />
          <h2 className="text-sm font-semibold text-text">Recent Activity</h2>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">
            No activity logged yet — CRM notes and updates will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {recentActivity.map((entry) => {
              const lead = Array.isArray(entry.leads) ? entry.leads[0] : entry.leads;
              return (
                <li key={entry.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-text truncate">
                      {lead?.seller_name && <span className="text-text-muted">{lead.seller_name}: </span>}
                      {entry.description}
                    </p>
                    <span className="label-tech">{entry.activity_type.replace(/_/g, " ")}</span>
                  </div>
                  <span className="text-[11px] text-text-subtle shrink-0">{formatRelative(entry.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PulseStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="px-3 py-2 first:pl-0 first:pt-0 sm:first:pt-2">
      <div className="label-tech">{label}</div>
      <div className={`num text-lg mt-0.5 ${accent ? "text-accent" : "text-text"}`}>{value}</div>
      <div className="text-[11px] text-text-subtle">{sub}</div>
    </div>
  );
}
