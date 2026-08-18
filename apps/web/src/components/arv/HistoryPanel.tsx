"use client";

import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { HistoryEntry } from "./types";

export function HistoryPanel({
  history,
  onOpen,
  onClose,
}: {
  history: HistoryEntry[];
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Analysis History" description="Previous ARV runs for this property." onClose={onClose} widthClassName="max-w-md">
      <div className="space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-text-muted">No previous analyses yet.</p>
        ) : (
          history.map((h) => (
            <button
              key={h.id}
              onClick={() => onOpen(h.id)}
              className="w-full text-left card p-3 hover:border-brand/40 transition-colors"
            >
              <p className="text-sm text-text">
                {formatDate(h.created_at)} — ARV {formatCurrency(h.arv_likely)} — MAO {formatCurrency(h.mao)}
              </p>
              <p className="text-xs text-text-subtle mt-0.5">{h.address}</p>
            </button>
          ))
        )}
        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="btn-secondary text-sm">Close</button>
        </div>
      </div>
    </Modal>
  );
}
