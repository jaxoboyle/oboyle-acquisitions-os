"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, ChevronRight, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, cn } from "@/lib/utils";
import {
  DEFAULT_BUYER_PCT,
  DEFAULT_WHOLESALE_FEE,
  BUYER_PCT_PRESETS,
  WHOLESALE_FEE_PRESETS,
  summarizeOffer,
  resolveActiveRepairs,
} from "@/lib/arv/calculate";
import { calculateArvFromComps } from "@/lib/arv/comps";
import { CompsDrawer } from "@/components/arv/CompsDrawer";
import { RepairsModal } from "@/components/arv/RepairsModal";
import { ProofModal } from "@/components/arv/ProofModal";
import { HistoryPanel } from "@/components/arv/HistoryPanel";
import { LeadPickerDialog } from "@/components/arv/LeadPickerDialog";
import type { ArvResultState, CompItem, HistoryEntry, PropertyFactsState, RepairBreakdownState } from "@/components/arv/types";

export interface InitialLead {
  id: string;
  seller_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

function combineAddress(lead: InitialLead): string {
  return [lead.address, lead.city, [lead.state, lead.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export function ArvCalculatorClient({
  initialLead,
  initialAnalysisId,
}: {
  initialLead: InitialLead | null;
  initialAnalysisId: string | null;
}) {
  const [leadId, setLeadId] = useState<string | null>(initialLead?.id ?? null);
  const [leadName, setLeadName] = useState<string | null>(initialLead?.seller_name ?? null);
  const [address, setAddress] = useState(initialLead ? combineAddress(initialLead) : "");

  const [loadingProperty, setLoadingProperty] = useState(false);
  const [loadingComps, setLoadingComps] = useState(false);
  const [propertyFacts, setPropertyFacts] = useState<PropertyFactsState | null>(null);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [comps, setComps] = useState<CompItem[]>([]);
  const [compsError, setCompsError] = useState<string | null>(null);
  const [arv, setArv] = useState<ArvResultState | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(true);

  const [repairsAiEstimate, setRepairsAiEstimate] = useState<number | null>(null);
  const [repairsManualOverride, setRepairsManualOverride] = useState<number | null>(null);
  const [repairBreakdown, setRepairBreakdown] = useState<RepairBreakdownState | null>(null);
  const [stagedPhotos, setStagedPhotos] = useState<File[]>([]);
  const [recalculatingRepairs, setRecalculatingRepairs] = useState(false);

  const [buyerPct, setBuyerPct] = useState(DEFAULT_BUYER_PCT);
  const [wholesaleFee, setWholesaleFee] = useState(DEFAULT_WHOLESALE_FEE);

  const [showComps, setShowComps] = useState(false);
  const [showRepairs, setShowRepairs] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLeadPicker, setShowLeadPicker] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);

  const analyzed = !!arv;
  const activeRepairs = resolveActiveRepairs(repairsAiEstimate, repairsManualOverride);
  const offer = useMemo(
    () => (arv ? summarizeOffer({ arv: arv.likely, buyerPct, repairs: activeRepairs, wholesaleFee }) : null),
    [arv, buyerPct, activeRepairs, wholesaleFee]
  );

  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/arv/history?leadId=${leadId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(() => {});
  }, [leadId, savedAnalysisId]);

  useEffect(() => {
    if (initialAnalysisId) void openHistoryAnalysis(initialAnalysisId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAnalysisId]);

  async function handleAnalyze() {
    if (!address.trim()) return;
    setLoadingProperty(true);
    setPropertyError(null);
    setCompsError(null);
    setArv(null);

    let facts: PropertyFactsState | null = null;
    try {
      const res = await fetch("/api/arv/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      }).then((r) => r.json());
      facts = res.facts ?? null;
      setPropertyFacts(facts);
      setProviderConfigured(res.configured !== false);
      if (res.error) setPropertyError(res.error);
    } catch {
      setPropertyError("Property lookup failed. You can still enter details manually.");
    } finally {
      setLoadingProperty(false);
    }

    setLoadingComps(true);
    try {
      const subject = {
        squareFootage: facts?.squareFootage ?? null,
        bedrooms: facts?.bedrooms ?? null,
        bathrooms: facts?.bathrooms ?? null,
        propertyType: facts?.propertyType ?? null,
        yearBuilt: facts?.yearBuilt ?? null,
      };
      const res = await fetch("/api/arv/comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, subject }),
      }).then((r) => r.json());
      setComps(res.comps ?? []);
      setArv(res.arv ?? null);
      setProviderConfigured((prev) => prev && res.configured !== false);
      if (res.error) setCompsError(res.error);
    } catch {
      setCompsError("Comp search failed. You can add comps manually.");
    } finally {
      setLoadingComps(false);
    }
  }

  function recomputeArvFromComps(nextComps: CompItem[]) {
    const result = calculateArvFromComps(
      nextComps.map((c) => ({ soldPrice: c.soldPrice, squareFootage: c.squareFootage, similarityScore: c.similarityScore, included: c.included })),
      propertyFacts?.squareFootage ?? null
    );
    setArv(result);
  }

  function handleToggleComp(index: number) {
    const next = comps.map((c, i) => (i === index ? { ...c, included: !c.included } : c));
    setComps(next);
    recomputeArvFromComps(next);
  }

  function handleAddManualComp(comp: CompItem) {
    const next = [...comps, comp];
    setComps(next);
    recomputeArvFromComps(next);
  }

  async function handleRecalculateRepairs() {
    if (stagedPhotos.length === 0) return;
    setRecalculatingRepairs(true);
    try {
      const formData = new FormData();
      formData.set("context", JSON.stringify({
        address,
        propertyType: propertyFacts?.propertyType ?? null,
        yearBuilt: propertyFacts?.yearBuilt ?? null,
        squareFootage: propertyFacts?.squareFootage ?? null,
      }));
      for (const file of stagedPhotos) formData.append("images", file);

      const res = await fetch("/api/arv/repairs", { method: "POST", body: formData }).then((r) => r.json());
      if (res.error) return;
      setRepairsAiEstimate(res.total ?? 0);
      setRepairBreakdown({
        breakdown: res.breakdown ?? {},
        total: res.total ?? 0,
        confidence: res.confidence ?? "low",
        confidenceReason: res.confidenceReason ?? "",
        narrative: res.narrative ?? "",
        photoCount: res.photoCount ?? 0,
        photoSource: res.photoSource ?? "No photos available — manual repair estimate recommended.",
      });
    } finally {
      setRecalculatingRepairs(false);
    }
  }

  async function openHistoryAnalysis(id: string) {
    const res = await fetch(`/api/arv/analysis/${id}`).then((r) => r.json());
    if (!res?.analysis) return;
    const a = res.analysis;
    setAddress(a.address);
    setLeadId(a.lead_id ?? null);
    setPropertyFacts({
      formattedAddress: a.address,
      city: a.city,
      state: a.state,
      zip: a.zip,
      parcelNumber: a.parcel_number,
      propertyType: a.property_type,
      bedrooms: a.bedrooms,
      bathrooms: a.bathrooms,
      squareFootage: a.square_footage,
      lotSizeSqft: a.lot_size_sqft,
      yearBuilt: a.year_built,
      lastSaleDate: a.last_sale_date,
      lastSalePrice: a.last_sale_price,
      assessedValue: a.assessed_value,
      taxAnnualAmount: a.tax_annual_amount,
      source: a.property_data_source ?? "—",
      sourceId: a.property_data_source_id,
      retrievedAt: a.property_data_retrieved_at ?? a.created_at,
    });
    setArv(a.arv_low != null ? { low: a.arv_low, likely: a.arv_likely, high: a.arv_high, confidence: a.arv_confidence ?? "low", compsUsed: (res.comps ?? []).filter((c: { included: boolean }) => c.included).length } : null);
    setComps(
      (res.comps ?? []).map((c: Record<string, unknown>) => ({
        address: c.address,
        soldPrice: c.sold_price,
        soldDate: c.sold_date,
        distanceMiles: c.distance_miles,
        squareFootage: c.square_footage,
        bedrooms: c.bedrooms,
        bathrooms: c.bathrooms,
        propertyType: c.property_type,
        yearBuilt: c.year_built,
        lotSizeSqft: c.lot_size_sqft,
        pricePerSqft: c.price_per_sqft,
        similarityScore: c.similarity_score ?? 0,
        included: c.included,
        isManual: c.is_manual,
        source: c.source,
        sourceId: c.source_id,
        sourceUrl: c.source_url,
        retrievedAt: c.retrieved_at,
      }))
    );
    setRepairsAiEstimate(a.repairs_ai_estimate);
    setRepairsManualOverride(a.repairs_manual_override);
    setRepairBreakdown(
      a.repair_breakdown
        ? {
            breakdown: a.repair_breakdown,
            total: a.repairs_ai_estimate ?? 0,
            confidence: a.repair_confidence ?? "low",
            confidenceReason: "",
            narrative: "",
            photoCount: a.repair_photos_analyzed_count ?? 0,
            photoSource: a.repair_photo_source ?? "",
          }
        : null
    );
    setBuyerPct(a.buyer_pct ?? DEFAULT_BUYER_PCT);
    setWholesaleFee(a.wholesale_fee ?? DEFAULT_WHOLESALE_FEE);
    setSavedAnalysisId(a.id);
    setShowHistory(false);
  }

  async function persistPhotos(analysisId: string) {
    if (stagedPhotos.length === 0) return;
    const formData = new FormData();
    formData.set("analysisId", analysisId);
    for (const file of stagedPhotos) formData.append("images", file);
    await fetch("/api/arv/photos", { method: "POST", body: formData }).catch(() => {});
  }

  async function handleSave(targetLeadId: string | null) {
    if (!arv || !offer) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/arv/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: targetLeadId,
          address,
          city: propertyFacts?.city ?? null,
          state: propertyFacts?.state ?? null,
          zip: propertyFacts?.zip ?? null,
          parcelNumber: propertyFacts?.parcelNumber ?? null,
          propertyType: propertyFacts?.propertyType ?? null,
          bedrooms: propertyFacts?.bedrooms ?? null,
          bathrooms: propertyFacts?.bathrooms ?? null,
          squareFootage: propertyFacts?.squareFootage ?? null,
          lotSizeSqft: propertyFacts?.lotSizeSqft ?? null,
          yearBuilt: propertyFacts?.yearBuilt ?? null,
          lastSaleDate: propertyFacts?.lastSaleDate ?? null,
          lastSalePrice: propertyFacts?.lastSalePrice ?? null,
          assessedValue: propertyFacts?.assessedValue ?? null,
          taxAnnualAmount: propertyFacts?.taxAnnualAmount ?? null,
          propertyDataSource: propertyFacts?.source ?? null,
          propertyDataSourceId: propertyFacts?.sourceId ?? null,
          propertyDataRetrievedAt: propertyFacts?.retrievedAt ?? null,
          arvLow: arv.low,
          arvLikely: arv.likely,
          arvHigh: arv.high,
          arvConfidence: arv.confidence,
          arvMethod: "weighted_price_per_sqft",
          repairsAiEstimate,
          repairsManualOverride,
          repairConfidence: repairBreakdown?.confidence ?? null,
          repairBreakdown: repairBreakdown?.breakdown ?? null,
          repairPhotoSource: repairBreakdown?.photoSource ?? "No photos available — manual repair estimate recommended.",
          repairPhotosAnalyzedCount: repairBreakdown?.photoCount ?? 0,
          buyerPct,
          wholesaleFee,
          comps: comps.map((c) => ({
            address: c.address,
            soldPrice: c.soldPrice,
            soldDate: c.soldDate,
            distanceMiles: c.distanceMiles,
            squareFootage: c.squareFootage,
            bedrooms: c.bedrooms,
            bathrooms: c.bathrooms,
            propertyType: c.propertyType,
            yearBuilt: c.yearBuilt,
            lotSizeSqft: c.lotSizeSqft,
            pricePerSqft: c.pricePerSqft,
            similarityScore: c.similarityScore,
            included: c.included,
            isManual: c.isManual,
            source: c.source,
            sourceId: c.sourceId,
            sourceUrl: c.sourceUrl,
            retrievedAt: c.retrievedAt,
          })),
        }),
      }).then((r) => r.json());

      if (res.error) {
        setSaveError(res.error);
        return;
      }
      setLeadId(targetLeadId);
      setSavedAnalysisId(res.id);
      await persistPhotos(res.id);
    } catch {
      setSaveError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveClick() {
    if (leadId) {
      void handleSave(leadId);
    } else {
      setShowLeadPicker(true);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-16">
      <PageHeader
        title="Offer Calculator"
        description={leadName ? `Running ARV for ${leadName}.` : "Enter an address to build a cash offer fast."}
        action={
          (leadId || savedAnalysisId) && (
            <button onClick={() => setShowHistory(true)} className="btn-secondary text-sm">
              History
            </button>
          )
        }
      />

      {!providerConfigured && (
        <div className="card p-3 bg-warning/10 border-warning/30">
          <p className="text-xs text-warning">
            No property/comps data provider is configured yet — automatic lookup and comps are unavailable. Enter property details and comps manually below.
          </p>
        </div>
      )}

      {/* Address + Analyze */}
      <div className="card p-4 space-y-3">
        <label className="text-xs text-text-muted block">Property Address</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Enter property address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <button
            onClick={handleAnalyze}
            disabled={!address.trim() || loadingProperty || loadingComps}
            className="btn-primary text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {(loadingProperty || loadingComps) && <Loader2 size={14} className="animate-spin" />}
            Analyze Property
          </button>
        </div>

        {propertyFacts && (
          <p className="text-xs text-text-subtle">
            {[
              propertyFacts.propertyType,
              propertyFacts.bedrooms != null ? `${propertyFacts.bedrooms} bd` : null,
              propertyFacts.bathrooms != null ? `${propertyFacts.bathrooms} ba` : null,
              propertyFacts.squareFootage != null ? `${propertyFacts.squareFootage} sqft` : null,
              propertyFacts.yearBuilt != null ? `built ${propertyFacts.yearBuilt}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No property facts found — enter comps manually."}
          </p>
        )}
        {propertyError && <p className="text-xs text-warning">{propertyError}</p>}
        {compsError && <p className="text-xs text-warning">{compsError}</p>}
      </div>

      {analyzed && offer && (
        <>
          {/* ARV */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">ARV</span>
              <Badge variant={arv!.confidence === "high" ? "success" : arv!.confidence === "medium" ? "warning" : "neutral"}>
                {arv!.confidence[0].toUpperCase() + arv!.confidence.slice(1)} Confidence
              </Badge>
            </div>
            <p className="text-3xl font-serif font-semibold text-text">{formatCurrency(arv!.likely)}</p>
            <p className="text-xs text-text-subtle">
              Low {formatCurrency(arv!.low)} · High {formatCurrency(arv!.high)}
            </p>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-text-subtle">
                Proof: {arv!.compsUsed} comp{arv!.compsUsed === 1 ? "" : "s"} used
                {repairBreakdown ? ` · ${repairBreakdown.photoCount} photo${repairBreakdown.photoCount === 1 ? "" : "s"} analyzed` : ""}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowComps(true)} className="text-xs text-brand hover:underline flex items-center gap-0.5">
                  View Comps <ChevronRight size={12} />
                </button>
                <button onClick={() => setShowProof(true)} className="text-xs text-brand hover:underline flex items-center gap-0.5">
                  View Proof <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Repairs */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Estimated Repairs</span>
              {repairBreakdown && (
                <Badge variant={repairBreakdown.confidence === "high" ? "success" : repairBreakdown.confidence === "medium" ? "warning" : "neutral"}>
                  {repairBreakdown.confidence[0].toUpperCase() + repairBreakdown.confidence.slice(1)} Confidence
                </Badge>
              )}
            </div>
            <p className="text-2xl font-serif font-semibold text-text">{formatCurrency(activeRepairs)}</p>
            {repairsManualOverride != null && (
              <p className="text-xs text-text-subtle">Manual override — AI estimate was {formatCurrency(repairsAiEstimate)}.</p>
            )}
            <button onClick={() => setShowRepairs(true)} className="text-xs text-brand hover:underline flex items-center gap-0.5">
              View Repairs <ChevronRight size={12} />
            </button>
          </div>

          {/* Wholesale fee + Buyer % */}
          <div className="card p-4 space-y-4">
            <PresetInput
              label="Wholesale Fee"
              value={wholesaleFee}
              onChange={setWholesaleFee}
              presets={WHOLESALE_FEE_PRESETS}
              formatPreset={(v) => formatCurrency(v)}
            />
            <div className="divider-brass" />
            <PresetInput
              label="Buyer Percentage"
              value={buyerPct}
              onChange={setBuyerPct}
              presets={BUYER_PCT_PRESETS}
              formatPreset={(v) => `${v}%`}
              suffix="%"
            />
          </div>

          {/* MAO */}
          <div className="card p-5 space-y-3 border-brand/30">
            <span className="text-xs text-text-muted">Maximum Allowable Offer (MAO)</span>
            <p className="text-4xl font-serif font-bold text-brand">{formatCurrency(offer.mao)}</p>
            <div className="text-xs text-text-subtle space-y-0.5 font-mono">
              <p>ARV: {formatCurrency(offer.arv)}</p>
              <p>{buyerPct}% Buyer Value: {formatCurrency(offer.buyerValue)}</p>
              <p>Repairs: -{formatCurrency(offer.repairs)}</p>
              <p>Wholesale Fee: -{formatCurrency(offer.wholesaleFee)}</p>
            </div>
            <div className="divider-brass" />
            <div>
              <span className="text-xs text-text-muted">Suggested Starting Offer</span>
              <p className="text-lg font-serif text-text">
                {formatCurrency(offer.offerRange.low)}–{formatCurrency(offer.offerRange.high)}
              </p>
            </div>
          </div>

          {/* Save */}
          <div className="card p-4 space-y-2">
            {leadId && <p className="text-xs text-text-subtle">Linked to lead: {leadName ?? leadId}</p>}
            <div className="flex items-center gap-2">
              <button onClick={handleSaveClick} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : savedAnalysisId ? <Check size={14} /> : null}
                {savedAnalysisId ? "Saved — Save Again" : "Save Analysis to Lead"}
              </button>
              {!leadId && (
                <button onClick={() => setShowLeadPicker(true)} className="btn-secondary text-sm flex items-center gap-1.5">
                  <Search size={13} /> Choose Lead
                </button>
              )}
            </div>
            {saveError && <p className="text-xs text-danger">{saveError}</p>}
          </div>
        </>
      )}

      {showComps && (
        <CompsDrawer comps={comps} onToggleInclude={handleToggleComp} onAddManual={handleAddManualComp} onClose={() => setShowComps(false)} />
      )}
      {showRepairs && (
        <RepairsModal
          aiEstimate={repairsAiEstimate}
          manualOverride={repairsManualOverride}
          breakdown={repairBreakdown}
          photos={stagedPhotos}
          recalculating={recalculatingRepairs}
          onManualOverrideChange={setRepairsManualOverride}
          onAddPhotos={(files) => setStagedPhotos((prev) => [...prev, ...files])}
          onRecalculate={handleRecalculateRepairs}
          onClose={() => setShowRepairs(false)}
        />
      )}
      {showProof && <ProofModal comps={comps} propertyFacts={propertyFacts} repairs={repairBreakdown} onClose={() => setShowProof(false)} />}
      {showHistory && <HistoryPanel history={history} onOpen={openHistoryAnalysis} onClose={() => setShowHistory(false)} />}
      {showLeadPicker && (
        <LeadPickerDialog
          onSelect={(lead) => {
            setLeadName(lead.seller_name);
            setShowLeadPicker(false);
            void handleSave(lead.id);
          }}
          onClose={() => setShowLeadPicker(false)}
        />
      )}

      {leadId && (
        <p className="text-center">
          <Link href="/leads" className="text-xs text-text-subtle hover:text-brand">
            ← Back to Leads
          </Link>
        </p>
      )}
    </div>
  );
}

function PresetInput({
  label,
  value,
  onChange,
  presets,
  formatPreset,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  presets: readonly number[];
  formatPreset: (v: number) => string;
  suffix?: string;
}) {
  const isCustom = !presets.includes(value as never);
  return (
    <div className="space-y-2">
      <label className="text-xs text-text-muted block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "text-xs px-2.5 py-1.5 rounded border transition-colors",
              value === p ? "border-brand bg-brand-muted text-brand font-medium" : "border-surface-border text-text-muted hover:text-text hover:border-brand/40"
            )}
          >
            {formatPreset(p)}
          </button>
        ))}
        <button
          onClick={() => {
            /* no-op: typing in the input below sets custom automatically */
          }}
          className={cn(
            "text-xs px-2.5 py-1.5 rounded border transition-colors",
            isCustom ? "border-brand bg-brand-muted text-brand font-medium" : "border-surface-border text-text-muted hover:text-text hover:border-brand/40"
          )}
        >
          Custom
        </button>
      </div>
      <div className="relative max-w-[160px]">
        <input
          type="number"
          className="input text-sm"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle text-sm">{suffix}</span>}
      </div>
    </div>
  );
}
