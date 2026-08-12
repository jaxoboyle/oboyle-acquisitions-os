import { useMemo, useState } from "react";
import { Search, Handshake } from "lucide-react";
import { useDeals } from "@/hooks/useDeals";
import { CLOSING_STATUSES, TITLE_STATUSES, type DealWithLead } from "@/lib/types";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DealDetailDialog } from "@/components/deals/DealDetailDialog";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function closingTone(status: string) {
  if (status === "closed") return "success" as const;
  if (status === "fell_through" || status === "delayed") return "danger" as const;
  return "accent" as const;
}

function titleTone(status: string) {
  if (status === "clear" || status === "resolved") return "success" as const;
  if (status === "issue_found") return "danger" as const;
  return "neutral" as const;
}

export function DealTracker() {
  const { data: deals, isLoading } = useDeals();
  const [search, setSearch] = useState("");
  const [closingFilter, setClosingFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [selected, setSelected] = useState<DealWithLead | null>(null);

  const filtered = useMemo(() => {
    if (!deals) return [];
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (closingFilter && d.closingStatus !== closingFilter) return false;
      if (titleFilter && d.titleStatus !== titleFilter) return false;
      if (!q) return true;
      return (
        d.sellerName.toLowerCase().includes(q) ||
        (d.address ?? "").toLowerCase().includes(q) ||
        (d.endBuyerName ?? "").toLowerCase().includes(q)
      );
    });
  }, [deals, search, closingFilter, titleFilter]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-text">Deal Tracker</h1>
        <p className="text-sm text-text-muted">
          Every lead that reaches Under Contract shows up here automatically.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search by seller, address, buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={closingFilter} onChange={(e) => setClosingFilter(e.target.value)} className="w-44">
          <option value="">All Closing Statuses</option>
          {CLOSING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
        <Select value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} className="w-44">
          <option value="">All Title Statuses</option>
          {TITLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No deals yet"
          description="Move a lead to Under Contract in the pipeline and it will appear here."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <Card
              key={d.id}
              className="cursor-pointer p-4 transition-colors hover:bg-surface-hover"
              onClick={() => setSelected(d)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text">{d.sellerName}</div>
                  <div className="truncate text-[12.5px] text-text-muted">
                    {d.address ? `${d.address}, ${d.city ?? ""} ${d.state ?? ""}` : "No address on file"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={titleTone(d.titleStatus)}>Title: {statusLabel(d.titleStatus)}</Badge>
                  <Badge tone={closingTone(d.closingStatus)}>Closing: {statusLabel(d.closingStatus)}</Badge>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[12.5px] sm:grid-cols-4">
                <div>
                  <div className="text-text-muted">Closing Date</div>
                  <div className="font-medium text-text">{formatDate(d.closingDate)}</div>
                </div>
                <div>
                  <div className="text-text-muted">End Buyer</div>
                  <div className="truncate font-medium text-text">{d.endBuyerName ?? "Not matched"}</div>
                </div>
                <div>
                  <div className="text-text-muted">Assignment Fee</div>
                  <div className="font-medium text-text">{formatCurrency(d.assignmentFee)}</div>
                </div>
                <div>
                  <div className="text-text-muted">Earnest Money</div>
                  <div className="font-medium text-text">
                    {formatCurrency(d.earnestMoneyAmount)}
                    {d.earnestMoneyDueDate && (
                      <span className="ml-1 font-normal text-text-muted">
                        due {formatDate(d.earnestMoneyDueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <DealDetailDialog deal={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
