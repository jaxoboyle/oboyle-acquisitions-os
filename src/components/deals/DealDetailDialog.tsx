import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { useDealForLead, useUpsertDeal } from "@/hooks/useDeals";
import { useBuyers } from "@/hooks/useBuyers";
import { CLOSING_STATUSES, TITLE_STATUSES, type DealInput, type DealWithLead } from "@/lib/types";
import { DocumentsPanel } from "@/components/leads/DocumentsPanel";
import { ActivityPanel } from "@/components/leads/ActivityPanel";

function toInput(deal: DealWithLead): DealInput {
  const {
    id: _id,
    leadId: _lid,
    createdAt: _c,
    updatedAt: _u,
    sellerName: _s,
    address: _a,
    city: _ci,
    state: _st,
    zip: _z,
    ...rest
  } = deal;
  return rest;
}

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function DealDetailDialog({
  deal,
  onClose,
}: {
  deal: DealWithLead | null;
  onClose: () => void;
}) {
  const { data: fresh } = useDealForLead(deal?.leadId);
  const current = fresh ?? deal;
  const upsertDeal = useUpsertDeal();
  const { data: buyers } = useBuyers();
  const [tab, setTab] = useState("details");
  const [form, setForm] = useState<DealInput | null>(null);

  useEffect(() => {
    if (current) setForm(toInput(current));
    setTab("details");
  }, [current?.leadId]);

  if (!deal) return null;

  function set<K extends keyof DealInput>(key: K, value: DealInput[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleSave() {
    if (!current || !form) return;
    upsertDeal.mutate({ leadId: current.leadId, input: form });
  }

  return (
    <Dialog
      open={!!deal && !!form}
      onClose={onClose}
      size="xl"
      title={
        current ? `${current.sellerName} — ${current.address ?? "No address"}` : ""
      }
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {tab === "details" && (
            <Button variant="primary" onClick={handleSave} disabled={upsertDeal.isPending}>
              {upsertDeal.isPending ? "Saving..." : "Save Deal"}
            </Button>
          )}
        </div>
      }
    >
      {current && form && (
        <div className="flex flex-col gap-4">
          <Tabs
            tabs={[
              { id: "details", label: "Deal Details" },
              { id: "documents", label: "Documents" },
              { id: "activity", label: "Activity" },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === "details" && (
            <div className="space-y-6">
              <section>
                <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">Contract & Dates</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Contract Date">
                    <Input
                      type="date"
                      value={form.contractDate ?? ""}
                      onChange={(e) => set("contractDate", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Earnest Money Amount">
                    <Input
                      type="number"
                      value={form.earnestMoneyAmount ?? ""}
                      onChange={(e) =>
                        set("earnestMoneyAmount", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </Field>
                  <Field label="Earnest Money Due Date">
                    <Input
                      type="date"
                      value={form.earnestMoneyDueDate ?? ""}
                      onChange={(e) => set("earnestMoneyDueDate", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Inspection Period Ends">
                    <Input
                      type="date"
                      value={form.inspectionPeriodEndDate ?? ""}
                      onChange={(e) => set("inspectionPeriodEndDate", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Closing Date">
                    <Input
                      type="date"
                      value={form.closingDate ?? ""}
                      onChange={(e) => set("closingDate", e.target.value || null)}
                    />
                  </Field>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">Title Company</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Title Company Name">
                    <Input
                      value={form.titleCompanyName ?? ""}
                      onChange={(e) => set("titleCompanyName", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Title Company Phone">
                    <Input
                      value={form.titleCompanyPhone ?? ""}
                      onChange={(e) => set("titleCompanyPhone", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Title Company Email">
                    <Input
                      type="email"
                      value={form.titleCompanyEmail ?? ""}
                      onChange={(e) => set("titleCompanyEmail", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Title Status">
                    <Select value={form.titleStatus} onChange={(e) => set("titleStatus", e.target.value)}>
                      {TITLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">Buyer & Money</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="End Buyer">
                    <Select
                      value={form.endBuyerId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        const name = buyers?.find((b) => b.id === id)?.buyerName ?? form.endBuyerName;
                        setForm((f) => (f ? { ...f, endBuyerId: id, endBuyerName: name ?? null } : f));
                      }}
                    >
                      <option value="">Not matched yet</option>
                      {buyers?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.buyerName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="End Buyer Name (if not on file)">
                    <Input
                      value={form.endBuyerName ?? ""}
                      onChange={(e) => set("endBuyerName", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Buyer Deposit">
                    <Input
                      type="number"
                      value={form.buyerDeposit ?? ""}
                      onChange={(e) => set("buyerDeposit", e.target.value ? Number(e.target.value) : null)}
                    />
                  </Field>
                  <Field label="Assignment Fee">
                    <Input
                      type="number"
                      value={form.assignmentFee ?? ""}
                      onChange={(e) =>
                        set("assignmentFee", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </Field>
                  <Field label="Closing Status">
                    <Select
                      value={form.closingStatus}
                      onChange={(e) => set("closingStatus", e.target.value)}
                    >
                      {CLOSING_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">Deal Notes</h4>
                <Textarea
                  value={form.dealNotes ?? ""}
                  onChange={(e) => set("dealNotes", e.target.value || null)}
                />
              </section>
            </div>
          )}

          {tab === "documents" && <DocumentsPanel leadId={current.leadId} />}
          {tab === "activity" && <ActivityPanel leadId={current.leadId} />}
        </div>
      )}
    </Dialog>
  );
}
