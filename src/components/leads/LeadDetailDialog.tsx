import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PriorityBadge } from "@/components/ui/Badge";
import { useLeads, useUpdateLead, useDeleteLead, useMoveLeadStage } from "@/hooks/useLeads";
import { CONTACT_METHODS, OCCUPANCY_OPTIONS, PRIORITIES, PROPERTY_TYPES, STAGES } from "@/lib/types";
import type { Lead, LeadInput } from "@/lib/types";
import { toastError } from "@/lib/toast";
import { ActivityPanel } from "./ActivityPanel";
import { DocumentsPanel } from "./DocumentsPanel";

function toInput(lead: Lead): LeadInput {
  const { id: _id, stage: _stage, stageOrder: _order, createdAt: _c, updatedAt: _u, ...rest } = lead;
  return rest;
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function LeadDetailDialog({
  leadId,
  onClose,
}: {
  leadId: string | null;
  onClose: () => void;
}) {
  const { data: leads } = useLeads();
  const lead = leads?.find((l) => l.id === leadId) ?? null;
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const moveStage = useMoveLeadStage();

  const [tab, setTab] = useState("details");
  const [form, setForm] = useState<LeadInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (lead) setForm(toInput(lead));
    setTab("details");
  }, [lead?.id]);

  if (!leadId) return null;

  function set<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleSave() {
    if (!lead || !form) return;
    if (!form.sellerName.trim()) {
      toastError("Seller name is required");
      return;
    }
    updateLead.mutate({ id: lead.id, input: form });
  }

  function handleStageChange(stage: string) {
    if (!lead) return;
    moveStage.mutate({ id: lead.id, stage, stageOrder: Date.now() });
  }

  return (
    <>
      <Dialog
        open={!!lead && !!form}
        onClose={onClose}
        size="xl"
        title={
          lead ? (
            <div className="flex items-center gap-2">
              <span>{lead.sellerName}</span>
              <PriorityBadge priority={lead.priority} />
            </div>
          ) : (
            ""
          )
        }
        footer={
          lead && (
            <div className="flex w-full items-center justify-between">
              <Button
                variant="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} /> Delete Lead
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                {tab === "details" && (
                  <Button variant="primary" onClick={handleSave} disabled={updateLead.isPending}>
                    {updateLead.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {lead && form && (
          <div className="flex flex-col gap-4">
            <Field label="Pipeline Stage">
              <Select value={lead.stage} onChange={(e) => handleStageChange(e.target.value)}>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Tabs
              tabs={[
                { id: "details", label: "Details" },
                { id: "activity", label: "Activity History" },
                { id: "documents", label: "Documents" },
              ]}
              active={tab}
              onChange={setTab}
            />

            {tab === "details" && (
              <div className="space-y-6">
                <section>
                  <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">
                    Seller Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Seller Name" required>
                      <Input
                        value={form.sellerName}
                        onChange={(e) => set("sellerName", e.target.value)}
                      />
                    </Field>
                    <Field label="Priority">
                      <Select value={form.priority} onChange={(e) => set("priority", e.target.value as any)}>
                        {PRIORITIES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Phone">
                      <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={form.email ?? ""}
                        onChange={(e) => set("email", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Preferred Contact Method">
                      <Select
                        value={form.preferredContactMethod ?? ""}
                        onChange={(e) => set("preferredContactMethod", e.target.value || null)}
                      >
                        <option value="">Select...</option>
                        {CONTACT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Best Time to Call">
                      <Input
                        value={form.bestTimeToCall ?? ""}
                        onChange={(e) => set("bestTimeToCall", e.target.value || null)}
                      />
                    </Field>
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">
                    Property Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Property Address" className="col-span-2">
                      <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value || null)} />
                    </Field>
                    <Field label="City">
                      <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value || null)} />
                    </Field>
                    <Field label="State">
                      <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value || null)} />
                    </Field>
                    <Field label="ZIP Code">
                      <Input value={form.zip ?? ""} onChange={(e) => set("zip", e.target.value || null)} />
                    </Field>
                    <Field label="Parcel Number / APN">
                      <Input
                        value={form.parcelNumber ?? ""}
                        onChange={(e) => set("parcelNumber", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Property Type">
                      <Select
                        value={form.propertyType ?? ""}
                        onChange={(e) => set("propertyType", e.target.value || null)}
                      >
                        <option value="">Select...</option>
                        {PROPERTY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Occupied or Vacant">
                      <Select
                        value={form.occupancy ?? ""}
                        onChange={(e) => set("occupancy", e.target.value || null)}
                      >
                        <option value="">Select...</option>
                        {OCCUPANCY_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Bedrooms">
                      <Input
                        type="number"
                        value={form.bedrooms ?? ""}
                        onChange={(e) => set("bedrooms", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Bathrooms">
                      <Input
                        type="number"
                        step="0.5"
                        value={form.bathrooms ?? ""}
                        onChange={(e) => set("bathrooms", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Square Footage">
                      <Input
                        type="number"
                        value={form.squareFootage ?? ""}
                        onChange={(e) => set("squareFootage", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Year Built">
                      <Input
                        type="number"
                        value={form.yearBuilt ?? ""}
                        onChange={(e) => set("yearBuilt", numOrNull(e.target.value))}
                      />
                    </Field>
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">Seller Situation</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Reason for Selling">
                      <Input
                        value={form.reasonForSelling ?? ""}
                        onChange={(e) => set("reasonForSelling", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Desired Selling Timeline">
                      <Input
                        value={form.desiredTimeline ?? ""}
                        onChange={(e) => set("desiredTimeline", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Asking Price">
                      <Input
                        type="number"
                        value={form.askingPrice ?? ""}
                        onChange={(e) => set("askingPrice", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Mortgage Balance">
                      <Input
                        type="number"
                        value={form.mortgageBalance ?? ""}
                        onChange={(e) => set("mortgageBalance", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Known Liens">
                      <Input
                        value={form.knownLiens ?? ""}
                        onChange={(e) => set("knownLiens", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Unpaid Taxes">
                      <Input
                        type="number"
                        value={form.unpaidTaxes ?? ""}
                        onChange={(e) => set("unpaidTaxes", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Property Condition">
                      <Input
                        value={form.propertyCondition ?? ""}
                        onChange={(e) => set("propertyCondition", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Repairs Needed">
                      <Input
                        value={form.repairsNeeded ?? ""}
                        onChange={(e) => set("repairsNeeded", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Conversation Notes" className="col-span-2">
                      <Textarea
                        value={form.conversationNotes ?? ""}
                        onChange={(e) => set("conversationNotes", e.target.value || null)}
                      />
                    </Field>
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">Deal Numbers</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Estimated ARV">
                      <Input
                        type="number"
                        value={form.arv ?? ""}
                        onChange={(e) => set("arv", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Estimated Repair Costs">
                      <Input
                        type="number"
                        value={form.estimatedRepairCosts ?? ""}
                        onChange={(e) => set("estimatedRepairCosts", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Maximum Allowable Offer">
                      <Input
                        type="number"
                        value={form.mao ?? ""}
                        onChange={(e) => set("mao", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Offer Amount">
                      <Input
                        type="number"
                        value={form.offerAmount ?? ""}
                        onChange={(e) => set("offerAmount", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Contract Price">
                      <Input
                        type="number"
                        value={form.contractPrice ?? ""}
                        onChange={(e) => set("contractPrice", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Buyer Price">
                      <Input
                        type="number"
                        value={form.buyerPrice ?? ""}
                        onChange={(e) => set("buyerPrice", numOrNull(e.target.value))}
                      />
                    </Field>
                    <Field label="Estimated Assignment Fee">
                      <Input
                        type="number"
                        value={form.estimatedAssignmentFee ?? ""}
                        onChange={(e) => set("estimatedAssignmentFee", numOrNull(e.target.value))}
                      />
                    </Field>
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 text-[12.5px] font-semibold text-text-muted">
                    Follow-Up Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Lead Source">
                      <Input
                        value={form.leadSource ?? ""}
                        onChange={(e) => set("leadSource", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Assigned User">
                      <Input
                        value={form.assignedUser ?? ""}
                        onChange={(e) => set("assignedUser", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Last Contact Date">
                      <Input
                        type="date"
                        value={form.lastContactDate ?? ""}
                        onChange={(e) => set("lastContactDate", e.target.value || null)}
                      />
                    </Field>
                    <Field label="Next Follow-Up Date">
                      <Input
                        type="date"
                        value={form.nextFollowUpDate ?? ""}
                        onChange={(e) => set("nextFollowUpDate", e.target.value || null)}
                      />
                    </Field>
                  </div>
                </section>
              </div>
            )}

            {tab === "activity" && <ActivityPanel leadId={lead.id} />}
            {tab === "documents" && <DocumentsPanel leadId={lead.id} />}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this lead?"
        description="This permanently deletes the lead along with its deal, documents, tasks, and activity history. This cannot be undone."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (lead) deleteLead.mutate(lead.id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}
