import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { useCreateBuyer, useUpdateBuyer } from "@/hooks/useBuyers";
import type { Buyer, BuyerInput, BuyerPreviousDealInput, FundingType } from "@/lib/types";
import { toastError } from "@/lib/toast";

function toInput(buyer: Buyer): BuyerInput {
  const { id: _id, createdAt: _c, updatedAt: _u, previousDeals, ...rest } = buyer;
  return {
    ...rest,
    previousDeals: previousDeals.map(({ propertyAddress, dealDate, price, notes }) => ({
      propertyAddress,
      dealDate,
      price,
      notes,
    })),
  };
}

const empty: BuyerInput = {
  buyerName: "",
  companyName: null,
  phone: null,
  email: null,
  areas: null,
  propertyTypes: null,
  maxPurchasePrice: null,
  maxRepairLevel: null,
  fundingType: "cash",
  proofOfFundsStatus: null,
  typicalClosingSpeed: null,
  preferredTitleCompany: null,
  notes: null,
  previousDeals: [],
};

export function BuyerFormDialog({
  open,
  buyer,
  onClose,
}: {
  open: boolean;
  buyer: Buyer | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BuyerInput>(empty);
  const createBuyer = useCreateBuyer();
  const updateBuyer = useUpdateBuyer();

  useEffect(() => {
    setForm(buyer ? toInput(buyer) : empty);
  }, [buyer, open]);

  function set<K extends keyof BuyerInput>(key: K, value: BuyerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateDeal(index: number, patch: Partial<BuyerPreviousDealInput>) {
    setForm((f) => ({
      ...f,
      previousDeals: f.previousDeals.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));
  }

  function removeDeal(index: number) {
    setForm((f) => ({ ...f, previousDeals: f.previousDeals.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!form.buyerName.trim()) {
      toastError("Buyer name is required");
      return;
    }
    if (buyer) {
      await updateBuyer.mutateAsync({ id: buyer.id, input: form });
    } else {
      await createBuyer.mutateAsync(form);
    }
    onClose();
  }

  const isPending = createBuyer.isPending || updateBuyer.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={buyer ? "Edit Buyer" : "Add Cash Buyer"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Buyer"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Buyer Name" required>
            <Input value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} />
          </Field>
          <Field label="Company Name">
            <Input value={form.companyName ?? ""} onChange={(e) => set("companyName", e.target.value || null)} />
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
          <Field label="Areas They Purchase In" className="col-span-2">
            <Input
              placeholder="e.g. Springfield, Decatur, 62701"
              value={form.areas ?? ""}
              onChange={(e) => set("areas", e.target.value || null)}
            />
          </Field>
          <Field label="Property Types" className="col-span-2">
            <Input
              placeholder="e.g. Single Family, Duplex"
              value={form.propertyTypes ?? ""}
              onChange={(e) => set("propertyTypes", e.target.value || null)}
            />
          </Field>
          <Field label="Maximum Purchase Price">
            <Input
              type="number"
              value={form.maxPurchasePrice ?? ""}
              onChange={(e) => set("maxPurchasePrice", e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label="Maximum Repair Level">
            <Input
              placeholder="e.g. Light, Moderate, Heavy"
              value={form.maxRepairLevel ?? ""}
              onChange={(e) => set("maxRepairLevel", e.target.value || null)}
            />
          </Field>
          <Field label="Cash or Financing">
            <Select value={form.fundingType} onChange={(e) => set("fundingType", e.target.value as FundingType)}>
              <option value="cash">Cash</option>
              <option value="financing">Financing</option>
              <option value="both">Both</option>
            </Select>
          </Field>
          <Field label="Proof of Funds Status">
            <Input
              value={form.proofOfFundsStatus ?? ""}
              onChange={(e) => set("proofOfFundsStatus", e.target.value || null)}
            />
          </Field>
          <Field label="Typical Closing Speed">
            <Input
              value={form.typicalClosingSpeed ?? ""}
              onChange={(e) => set("typicalClosingSpeed", e.target.value || null)}
            />
          </Field>
          <Field label="Preferred Title Company">
            <Input
              value={form.preferredTitleCompany ?? ""}
              onChange={(e) => set("preferredTitleCompany", e.target.value || null)}
            />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
          </Field>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[12.5px] font-semibold text-text-muted">Previous Deals</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  previousDeals: [
                    ...f.previousDeals,
                    { propertyAddress: "", dealDate: "", price: null, notes: "" },
                  ],
                }))
              }
            >
              <Plus size={13} /> Add Deal
            </Button>
          </div>
          {form.previousDeals.length === 0 ? (
            <p className="text-[12.5px] text-text-muted">No previous deals recorded.</p>
          ) : (
            <div className="space-y-2">
              {form.previousDeals.map((d, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-md border border-border p-2">
                  <Input
                    className="col-span-5"
                    placeholder="Property address"
                    value={d.propertyAddress ?? ""}
                    onChange={(e) => updateDeal(i, { propertyAddress: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    type="date"
                    value={d.dealDate ?? ""}
                    onChange={(e) => updateDeal(i, { dealDate: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    placeholder="Price"
                    value={d.price ?? ""}
                    onChange={(e) => updateDeal(i, { price: e.target.value ? Number(e.target.value) : null })}
                  />
                  <button
                    onClick={() => removeDeal(i)}
                    className="col-span-1 flex justify-center text-text-muted hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}
