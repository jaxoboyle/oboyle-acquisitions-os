import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Sparkles,
  BellRing,
  FileSignature,
  FileCheck2,
  Search,
  CalendarClock,
  DollarSign,
  PartyPopper,
} from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

export function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard.stats,
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-text">Dashboard</h1>
        <p className="text-sm text-text-muted">An overview of your wholesale pipeline.</p>
      </div>

      {isLoading || !stats ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              label="Total Leads"
              value={String(stats.totalLeads)}
              icon={Users}
              tone="neutral"
              onClick={() => navigate("/pipeline")}
            />
            <StatCard
              label="New Leads"
              value={String(stats.newLeads)}
              icon={Sparkles}
              tone="accent"
              onClick={() => navigate("/pipeline")}
            />
            <StatCard
              label="Follow-Ups Due Today"
              value={String(stats.followUpsDueToday)}
              icon={BellRing}
              tone="warning"
              onClick={() => navigate("/tasks")}
            />
            <StatCard
              label="Offers Sent"
              value={String(stats.offersSent)}
              icon={FileSignature}
              tone="accent"
              onClick={() => navigate("/pipeline")}
            />
            <StatCard
              label="Under Contract"
              value={String(stats.underContract)}
              icon={FileCheck2}
              tone="success"
              onClick={() => navigate("/deals")}
            />
            <StatCard
              label="Needing Buyers"
              value={String(stats.needingBuyers)}
              icon={Search}
              tone="warning"
              onClick={() => navigate("/pipeline")}
            />
            <StatCard
              label="Expected Assignment Fees"
              value={formatCurrency(stats.expectedAssignmentFees)}
              icon={DollarSign}
              tone="success"
              onClick={() => navigate("/deals")}
            />
            <StatCard
              label="Closed This Month"
              value={String(stats.closedDealsThisMonth)}
              icon={PartyPopper}
              tone="success"
              onClick={() => navigate("/deals")}
            />
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Upcoming Closings</CardTitle>
                <CalendarClock size={16} className="text-text-muted" />
              </CardHeader>
              <CardBody>
                {stats.upcomingClosings.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="No upcoming closings"
                    description="Deals with a scheduled closing date will show up here."
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {stats.upcomingClosings.map((c) => (
                      <button
                        key={c.leadId}
                        onClick={() => navigate("/deals")}
                        className="flex w-full items-center justify-between py-2.5 text-left hover:bg-surface-hover"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-text">
                            {c.sellerName}
                          </div>
                          <div className="truncate text-[12.5px] text-text-muted">
                            {c.address ?? "No address on file"}
                          </div>
                        </div>
                        <div className="shrink-0 text-[12.5px] font-medium text-text-muted">
                          {formatDate(c.closingDate)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
