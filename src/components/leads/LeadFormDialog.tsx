import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { useCreateLead, useMoveLeadStage } from "@/hooks/useLeads";
import { CONTACT_METHODS, PRIORITIES, type Priority } from "@/lib/types";
import { toastError } from "@/lib/toast";

const empty = {
  sellerName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  askingPrice: "",
  leadSource: "",
  preferredContactMethod: "",
  priority: "medium" as Priority,
};

export function LeadFormDialog({
  open,
  onClose,
  initialStage,
}: {
  open: boolean;
  onClose: () => void;
  initialStage?: string;
}) {
  const [form, setForm] = useState(empty);
  const createLead = useCreateLead();
  const moveStage = useMoveLeadStage();

  function set<K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClose() {
    setForm(empty);
    onClose();
  }

  async function handleCreate() {
    if (!form.sellerName.trim()) {
      toastError("Seller name is required");
      return;
    }
    const created = await createLead.mutateAsync({
      sellerName: form.sellerName.trim(),
      phone: form.phone || null,
      email: form.email || null,
      preferredContactMethod: form.preferredContactMethod || null,
      bestTimeToCall: null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      parcelNumber: null,
      propertyType: null,
      bedrooms: null,
      bathrooms: null,
      squareFootage: null,
      yearBuilt: null,
      occupancy: null,
      reasonForSelling: null,
      desiredTimeline: null,
      askingPrice: form.askingPrice ? Number(form.askingPrice) : null,
      mortgageBalance: null,
      knownLiens: null,
      unpaidTaxes: null,
      propertyCondition: null,
      repairsNeeded: null,
      conversationNotes: null,
      arv: null,
      estimatedRepairCosts: null,
      mao: null,
      offerAmount: null,
      contractPrice: null,
      buyerPrice: null,
      estimatedAssignmentFee: null,
      leadSource: form.leadSource || null,
      priority: form.priority,
      lastContactDate: null,
      nextFollowUpDate: null,
      assignedUser: null,
    });

    if (initialStage && initialStage !== "new_lead") {
      moveStage.mutate({ id: created.id, stage: initialStage, stageOrder: Date.now() });
    }

    handleClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add New Lead"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={createLead.isPending}>
            {createLead.isPending ? "Adding..." : "Add Lead"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seller Name" required className="col-span-2">
          <Input value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} autoFocus />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Preferred Contact Method">
          <Select
            value={form.preferredContactMethod}
            onChange={(e) => set("preferredContactMethod", e.target.value)}
          >
            <option value="">Select...</option>
            {CONTACT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property Address" className="col-span-2">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="State">
          <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
        </Field>
        <Field label="ZIP Code">
          <Input value={form.zip} onChange={(e) => set("zip", e.target.value)} />
        </Field>
        <Field label="Asking Price">
          <Input
            type="number"
            value={form.askingPrice}
            onChange={(e) => set("askingPrice", e.target.value)}
          />
        </Field>
        <Field label="Lead Source" className="col-span-2">
          <Input value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
