"use client";

import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CompItem, PropertyFactsState, RepairBreakdownState } from "./types";

export function ProofModal({
  comps,
  propertyFacts,
  repairs,
  onClose,
}: {
  comps: CompItem[];
  propertyFacts: PropertyFactsState | null;
  repairs: RepairBreakdownState | null;
  onClose: () => void;
}) {
  const included = comps.filter((c) => c.included);

  return (
    <Modal title="Proof" description="Where these numbers came from." onClose={onClose} widthClassName="max-w-lg">
      <div className="space-y-4 text-sm">
        {propertyFacts && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">Property Data</p>
            <p className="text-text-subtle text-xs">
              Source: {propertyFacts.source} · Retrieved {formatDate(propertyFacts.retrievedAt)}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-text-muted mb-2">
            {included.length} comp{included.length === 1 ? "" : "s"} used
          </p>
          <div className="space-y-2">
            {included.map((c, i) => (
              <div key={i} className="border-l-2 border-brand/40 pl-3">
                <p className="text-text font-medium">Comp {i + 1}</p>
                <p className="text-text-muted">
                  {c.address} — {formatCurrency(c.soldPrice)} — {formatDate(c.soldDate)}
                  {c.distanceMiles != null ? ` — ${c.distanceMiles.toFixed(1)} mi` : ""}
                </p>
                <p className="text-text-subtle text-xs">
                  Source: {c.isManual ? "Manual entry" : c.source ?? "Unknown"}
                  {c.sourceUrl ? ` (${c.sourceUrl})` : ""}
                </p>
              </div>
            ))}
            {included.length === 0 && <p className="text-text-subtle text-xs">No comps included yet.</p>}
          </div>
        </div>

        {repairs && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">Repairs</p>
            <p className="text-text-subtle text-xs">{repairs.photoSource}</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="btn-primary text-sm">Close</button>
        </div>
      </div>
    </Modal>
  );
}
