"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { CompItem } from "./types";

export function CompsDrawer({
  comps,
  onToggleInclude,
  onAddManual,
  onClose,
}: {
  comps: CompItem[];
  onToggleInclude: (index: number) => void;
  onAddManual: (comp: CompItem) => void;
  onClose: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <Modal title="Comps" description={`${comps.length} comp${comps.length === 1 ? "" : "s"} found — toggle to include/exclude from ARV.`} onClose={onClose} widthClassName="max-w-3xl">
      <div className="space-y-3">
        {comps.length === 0 ? (
          <p className="text-sm text-text-muted">No comps yet. Add one manually below, or run Analyze Property first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th></th>
                  <th>Address</th>
                  <th>Sold Price</th>
                  <th>Sold Date</th>
                  <th>Distance</th>
                  <th>Sqft</th>
                  <th>Bd/Ba</th>
                  <th>$/sqft</th>
                  <th>Match</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c, i) => (
                  <tr key={i} className={c.included ? "" : "opacity-50"}>
                    <td>
                      <input
                        type="checkbox"
                        checked={c.included}
                        onChange={() => onToggleInclude(i)}
                        className="accent-brand"
                        aria-label={c.included ? "Exclude comp" : "Include comp"}
                      />
                    </td>
                    <td className="text-text">{c.address}</td>
                    <td className="font-serif text-text">{formatCurrency(c.soldPrice)}</td>
                    <td className="text-text-muted">{formatDate(c.soldDate)}</td>
                    <td className="text-text-muted">{c.distanceMiles != null ? `${c.distanceMiles.toFixed(1)} mi` : "—"}</td>
                    <td className="text-text-muted">{c.squareFootage ?? "—"}</td>
                    <td className="text-text-muted">{c.bedrooms ?? "—"}/{c.bathrooms ?? "—"}</td>
                    <td className="text-text-muted">{c.pricePerSqft != null ? `$${c.pricePerSqft.toFixed(0)}` : "—"}</td>
                    <td>
                      <Badge variant={c.similarityScore >= 75 ? "success" : c.similarityScore >= 55 ? "warning" : "neutral"}>
                        {c.similarityScore}%
                      </Badge>
                    </td>
                    <td className="text-text-subtle text-xs">{c.isManual ? "Manual" : c.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAddForm ? (
          <ManualCompForm
            onCancel={() => setShowAddForm(false)}
            onAdd={(comp) => {
              onAddManual(comp);
              setShowAddForm(false);
            }}
          />
        ) : (
          <button onClick={() => setShowAddForm(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <Plus size={14} /> Add Comp Manually
          </button>
        )}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="btn-primary text-sm">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ManualCompForm({ onAdd, onCancel }: { onAdd: (comp: CompItem) => void; onCancel: () => void }) {
  const [address, setAddress] = useState("");
  const [soldPrice, setSoldPrice] = useState("");
  const [soldDate, setSoldDate] = useState("");
  const [squareFootage, setSquareFootage] = useState("");
  const [saving, setSaving] = useState(false);

  function handleAdd() {
    if (!address.trim() || !soldPrice) return;
    setSaving(true);
    const sqft = squareFootage ? Number(squareFootage) : null;
    const price = Number(soldPrice);
    onAdd({
      address: address.trim(),
      soldPrice: price,
      soldDate: soldDate || null,
      distanceMiles: null,
      squareFootage: sqft,
      bedrooms: null,
      bathrooms: null,
      propertyType: null,
      yearBuilt: null,
      lotSizeSqft: null,
      pricePerSqft: sqft ? Math.round((price / sqft) * 100) / 100 : null,
      similarityScore: 60,
      included: true,
      isManual: true,
      source: "Manual entry",
      sourceId: null,
      sourceUrl: null,
      retrievedAt: new Date().toISOString(),
    });
    setSaving(false);
  }

  return (
    <div className="card p-3 space-y-2 bg-bg-muted">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className="input text-sm" placeholder="Comp address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input className="input text-sm" placeholder="Sold price" type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} />
        <input className="input text-sm" placeholder="Sold date" type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} />
        <input className="input text-sm" placeholder="Square footage" type="number" value={squareFootage} onChange={(e) => setSquareFootage(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={handleAdd} disabled={!address.trim() || !soldPrice || saving} className={cn("btn-primary text-sm flex items-center gap-1.5", (!address.trim() || !soldPrice) && "opacity-50")}>
          {saving && <Loader2 size={14} className="animate-spin" />} Add
        </button>
      </div>
    </div>
  );
}
