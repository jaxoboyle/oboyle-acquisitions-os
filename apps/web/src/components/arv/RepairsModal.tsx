"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, RotateCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { categoryLabel } from "@/lib/arv/repair-categories";
import type { RepairBreakdownState } from "./types";

export function RepairsModal({
  aiEstimate,
  manualOverride,
  breakdown,
  photos,
  recalculating,
  onManualOverrideChange,
  onAddPhotos,
  onRecalculate,
  onClose,
}: {
  aiEstimate: number | null;
  manualOverride: number | null;
  breakdown: RepairBreakdownState | null;
  photos: File[];
  recalculating: boolean;
  onManualOverrideChange: (value: number | null) => void;
  onAddPhotos: (files: File[]) => void;
  onRecalculate: () => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [overrideText, setOverrideText] = useState(manualOverride != null ? String(manualOverride) : "");

  function commitOverride(v: string) {
    setOverrideText(v);
    onManualOverrideChange(v.trim() === "" ? null : Number(v));
  }

  return (
    <Modal title="Repair Estimate" onClose={onClose} widthClassName="max-w-lg">
      <div className="space-y-4">
        {breakdown?.confidence && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Repair Confidence:</span>
            <Badge variant={breakdown.confidence === "high" ? "success" : breakdown.confidence === "medium" ? "warning" : "neutral"}>
              {breakdown.confidence[0].toUpperCase() + breakdown.confidence.slice(1)}
            </Badge>
          </div>
        )}

        {breakdown?.confidenceReason && <p className="text-xs text-text-subtle">{breakdown.confidenceReason}</p>}

        <p className="text-xs text-text-subtle">
          {breakdown?.photoSource ?? "No photos available — manual repair estimate recommended."}
        </p>

        {breakdown && Object.keys(breakdown.breakdown).length > 0 && (
          <div className="space-y-1">
            {Object.entries(breakdown.breakdown).map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{categoryLabel(cat)}</span>
                <span className="font-serif text-text">{formatCurrency(amount)}</span>
              </div>
            ))}
            <div className="divider-brass my-2" />
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-text">AI Estimate Total</span>
              <span className="font-serif text-text">{formatCurrency(aiEstimate)}</span>
            </div>
          </div>
        )}

        {breakdown?.narrative && <p className="text-xs text-text-subtle italic">{breakdown.narrative}</p>}

        <div className="divider-brass" />

        <div>
          <label className="text-xs text-text-muted block mb-1">Manual Repair Override</label>
          <input
            type="number"
            className="input text-sm"
            placeholder={aiEstimate != null ? `AI estimate: ${formatCurrency(aiEstimate)}` : "Enter your own estimate"}
            value={overrideText}
            onChange={(e) => commitOverride(e.target.value)}
          />
          <p className="text-xs text-text-subtle mt-1">If set, this overrides the AI estimate for MAO/offer calculations.</p>
        </div>

        <div className="divider-brass" />

        <div>
          <label className="text-xs text-text-muted block mb-1">Upload Photos</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onAddPhotos(files);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm flex items-center gap-1.5">
              <Upload size={14} /> Add Photos
            </button>
            <span className="text-xs text-text-subtle">{photos.length} photo{photos.length === 1 ? "" : "s"} staged</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onRecalculate}
            disabled={recalculating || photos.length === 0}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            {recalculating ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
            Recalculate Repairs
          </button>
          <button onClick={onClose} className="btn-primary text-sm">Done</button>
        </div>
      </div>
    </Modal>
  );
}
