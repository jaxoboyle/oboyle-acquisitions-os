import Link from "next/link";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatRelative } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

const REPORT_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  ninety_day: "90-Day",
  custom: "Custom",
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const [{ data: reports }, { data: revenueTarget }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, report_type, period_start, period_end, generated_at")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(30),

    supabase
      .from("revenue_targets")
      .select("target_main, collected, contracted_awaiting_closing, projected_pipeline, total_expenses, period_start, period_end")
      .eq("user_id", user.id)
      .eq("period_type", "thirty_day")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Reports"
        description="Generated performance reports and the current-period ledger summary."
      />

      {/* ── Current period — investment-report style summary ─────────────── */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-5 pb-4 divider-brass">
          <h2 className="text-sm font-serif font-semibold text-text tracking-wide uppercase">
            Current Period Summary
          </h2>
          {revenueTarget && (
            <span className="text-xs text-text-muted">
              {formatDate(revenueTarget.period_start)} – {formatDate(revenueTarget.period_end)}
            </span>
          )}
        </div>

        {!revenueTarget ? (
          <p className="text-sm text-text-muted text-center py-6">
            No revenue target has been set for the current period.
          </p>
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5 text-sm">
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wide">Target</dt>
              <dd className="font-serif text-lg text-text mt-1">{formatCurrency(revenueTarget.target_main)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wide">Collected</dt>
              <dd className="font-serif text-lg text-accent mt-1">{formatCurrency(revenueTarget.collected)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wide">Contracted</dt>
              <dd className="font-serif text-lg text-text mt-1">
                {formatCurrency(revenueTarget.contracted_awaiting_closing)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wide">Pipeline</dt>
              <dd className="font-serif text-lg text-text-muted mt-1">
                {formatCurrency(revenueTarget.projected_pipeline)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wide">Expenses</dt>
              <dd className="font-serif text-lg text-danger mt-1">
                {formatCurrency(revenueTarget.total_expenses)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wide">Net</dt>
              <dd className="font-serif text-lg text-text mt-1">
                {formatCurrency(revenueTarget.collected - revenueTarget.total_expenses)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* ── Generated reports ──────────────────────────────────────────── */}
      <section className="card p-0 overflow-hidden">
        <h2 className="text-sm font-semibold text-text px-5 pt-5 pb-3">Generated Reports</h2>
        {!reports || reports.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No reports generated yet"
            description="Daily, weekly, monthly, and 90-day reports produced by Big Stein will be archived here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Generated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <Badge variant="brand">{REPORT_LABEL[report.report_type] ?? report.report_type}</Badge>
                    </td>
                    <td className="text-text-muted">
                      {formatDate(report.period_start)} – {formatDate(report.period_end)}
                    </td>
                    <td className="text-text-muted">{formatRelative(report.generated_at)}</td>
                    <td>
                      <Link href={`/reports/${report.id}`} className="text-xs text-brand hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
