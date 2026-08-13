import { notFound } from "next/navigation";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle, Target, TrendingUp, Clock } from "lucide-react";
import type { EodReviewContent } from "@/lib/ai/eod-review";
import { formatMinutes } from "@/lib/utils";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: report } = await supabase
    .from("reports")
    .select("id, report_type, period_start, period_end, content")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!report) notFound();

  const content = report.content as Partial<EodReviewContent>;
  const isDaily = report.report_type === "daily";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title={isDaily ? "End-of-Day Review" : `${report.report_type} Report`}
        description={formatDate(report.period_start)}
      />

      {isDaily ? (
        <>
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4 pb-4 divider-brass">
              <h2 className="text-sm font-serif font-semibold text-text tracking-wide uppercase">
                Big Stein Daily Score
              </h2>
              <span className="num text-2xl font-serif font-semibold text-accent">{content.score ?? "—"}/10</span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <Stat label="Hours" value={`${content.hours_worked ?? 0} / ${content.target_hours ?? 0}`} />
              <Stat label="Tasks Completed" value={String(content.tasks_completed ?? 0)} />
              <Stat label="Tasks Active" value={String(content.tasks_active ?? 0)} />
              <Stat label="Overdue" value={String(content.tasks_overdue ?? 0)} danger={(content.tasks_overdue ?? 0) > 0} />
              <Stat label="Seller Calls" value={String(content.seller_calls ?? 0)} />
              <Stat label="Leads Generated" value={String(content.leads_generated ?? 0)} />
              <Stat label="Follow-Ups" value={String(content.follow_ups ?? 0)} />
              <Stat label="Offers" value={String(content.offers ?? 0)} />
              <Stat label="Buyers Contacted" value={String(content.buyers_contacted ?? 0)} />
              <Stat label="Deals Advanced" value={String(content.deals_advanced ?? 0)} />
            </dl>
          </section>

          {content.task_time_breakdown && content.task_time_breakdown.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                <Clock size={15} className="text-brand" /> Time by Task
              </h2>
              <ul className="divide-y divide-surface-border">
                {content.task_time_breakdown.map((t, idx) => (
                  <li key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <span className="text-sm text-text truncate">{t.title}</span>
                    <span className="text-xs text-text-muted num shrink-0">{formatMinutes(t.minutes)}</span>
                  </li>
                ))}
                {!!content.unplanned_work_minutes && (
                  <li className="py-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-warning">Unplanned / Unlabeled Work</span>
                    <span className="text-xs text-text-muted num shrink-0">{formatMinutes(content.unplanned_work_minutes)}</span>
                  </li>
                )}
              </ul>
            </section>
          )}

          <section className="card p-5 space-y-4">
            <ReviewBlock icon={CheckCircle2} iconClass="text-success" title="What went well" text={content.what_went_well} />
            <ReviewBlock icon={XCircle} iconClass="text-warning" title="Where you fell short" text={content.where_fell_short} />
            <ReviewBlock icon={XCircle} iconClass="text-danger" title="Time wasted" text={content.time_wasted} />
          </section>

          {content.improvements && content.improvements.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                <Target size={15} className="text-brand" /> Improvements for tomorrow
              </h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-text">
                {content.improvements.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {(content.weekly_progress_note || content.next_priority) && (
            <section className="card p-5 space-y-3">
              {content.weekly_progress_note && (
                <div>
                  <span className="label-tech flex items-center gap-1.5">
                    <TrendingUp size={13} /> Weekly / Monthly Progress
                  </span>
                  <p className="text-sm text-text mt-1">{content.weekly_progress_note}</p>
                </div>
              )}
              {content.next_priority && (
                <div>
                  <span className="label-tech">Next Session Priority</span>
                  <p className="text-sm text-text mt-1">{content.next_priority}</p>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <section className="card p-5">
          <pre className="text-xs text-text-muted whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-text-muted uppercase tracking-wide">{label}</dt>
      <dd className={`font-serif text-lg mt-1 ${danger ? "text-danger" : "text-text"}`}>{value}</dd>
    </div>
  );
}

function ReviewBlock({
  icon: Icon,
  iconClass,
  title,
  text,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  text?: string;
}) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className={`${iconClass} shrink-0 mt-0.5`} />
      <div>
        <p className="text-sm font-medium text-text">{title}</p>
        <p className="text-sm text-text-muted mt-0.5">{text}</p>
      </div>
    </div>
  );
}
