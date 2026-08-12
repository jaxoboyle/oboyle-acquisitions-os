import { useMemo, useState } from "react";
import { Plus, Search, Users, Trash2, Pencil } from "lucide-react";
import { useBuyers, useDeleteBuyer } from "@/hooks/useBuyers";
import type { Buyer } from "@/lib/types";
import { PROPERTY_TYPES } from "@/lib/types";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BuyerFormDialog } from "@/components/buyers/BuyerFormDialog";
import { formatCurrency } from "@/lib/utils";

export function Buyers() {
  const { data: buyers, isLoading } = useBuyers();
  const deleteBuyer = useDeleteBuyer();

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Buyer | null>(null);

  const filtered = useMemo(() => {
    if (!buyers) return [];
    const q = search.trim().toLowerCase();
    const loc = locationFilter.trim().toLowerCase();
    const price = minPrice ? Number(minPrice) : null;
    return buyers.filter((b) => {
      if (q && !(`${b.buyerName} ${b.companyName ?? ""}`.toLowerCase().includes(q))) return false;
      if (loc && !(b.areas ?? "").toLowerCase().includes(loc)) return false;
      if (propertyTypeFilter && !(b.propertyTypes ?? "").toLowerCase().includes(propertyTypeFilter.toLowerCase()))
        return false;
      if (price !== null && (b.maxPurchasePrice ?? 0) < price) return false;
      return true;
    });
  }, [buyers, search, locationFilter, propertyTypeFilter, minPrice]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Cash-Buyer Database</h1>
          <p className="text-sm text-text-muted">Match properties with the right buyer, fast.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditingBuyer(null);
            setFormOpen(true);
          }}
        >
          <Plus size={15} /> Add Buyer
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search buyers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Input
          placeholder="Location (city, ZIP)"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="w-48"
        />
        <Select
          value={propertyTypeFilter}
          onChange={(e) => setPropertyTypeFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All Property Types</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          placeholder="Min budget needed"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No buyers found"
          description="Add your cash buyers so you can match them to new deals."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text">{b.buyerName}</div>
                  {b.companyName && (
                    <div className="truncate text-[12.5px] text-text-muted">{b.companyName}</div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded p-1.5 text-text-muted hover:bg-surface-hover hover:text-text"
                    onClick={() => {
                      setEditingBuyer(b);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="rounded p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                    onClick={() => setPendingDelete(b)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge tone="accent">{b.fundingType === "both" ? "Cash / Financing" : b.fundingType}</Badge>
                {b.maxPurchasePrice && (
                  <Badge tone="success">Up to {formatCurrency(b.maxPurchasePrice)}</Badge>
                )}
                {b.proofOfFundsStatus && <Badge tone="neutral">POF: {b.proofOfFundsStatus}</Badge>}
              </div>

              <div className="space-y-1 text-[12.5px] text-text-muted">
                {b.phone && <div>{b.phone}{b.email ? ` · ${b.email}` : ""}</div>}
                {b.areas && <div>Areas: {b.areas}</div>}
                {b.propertyTypes && <div>Property Types: {b.propertyTypes}</div>}
                {b.maxRepairLevel && <div>Max Repair Level: {b.maxRepairLevel}</div>}
                {b.typicalClosingSpeed && <div>Typical Closing: {b.typicalClosingSpeed}</div>}
              </div>

              {b.previousDeals.length > 0 && (
                <div className="mt-3 border-t border-border pt-2 text-[12px] text-text-muted">
                  {b.previousDeals.length} previous deal{b.previousDeals.length === 1 ? "" : "s"} on file
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <BuyerFormDialog open={formOpen} buyer={editingBuyer} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this buyer?"
        description={`This permanently removes ${pendingDelete?.buyerName ?? "this buyer"} from your database.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteBuyer.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
