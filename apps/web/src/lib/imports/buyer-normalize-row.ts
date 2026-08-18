import type { BuyerTargetField } from "./buyer-column-map";
import { cleanString, parseMoney } from "./normalize";

export type BuyerCandidate = {
  buyer_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  areas: string | null;
  property_types: string | null;
  max_purchase_price: number | null;
  max_repair_level: string | null;
  funding_type: string | null;
  proof_of_funds_status: string | null;
  typical_closing_speed: string | null;
  preferred_title_company: string | null;
  notes: string | null;
  raw: Record<string, string>;
  valid: boolean;
  skip_reason: string | null;
};

const VALID_FUNDING_TYPES = new Set(["cash", "financing", "both"]);

function normalizeFundingType(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (VALID_FUNDING_TYPES.has(lower)) return lower;
  if (lower.includes("cash") && (lower.includes("financ") || lower.includes("loan"))) return "both";
  if (lower.includes("cash")) return "cash";
  if (lower.includes("financ") || lower.includes("loan") || lower.includes("mortgage")) return "financing";
  return null; // falls back to the buyers table's own default ('cash') on insert
}

export function normalizeBuyerRow(
  row: Record<string, string>,
  mapping: Record<string, BuyerTargetField | null>
): BuyerCandidate {
  const byField: Partial<Record<BuyerTargetField, string>> = {};
  const extras: string[] = [];

  for (const [header, value] of Object.entries(row)) {
    const clean = cleanString(value);
    if (!clean) continue;
    const field = mapping[header];
    if (!field) continue;

    if (byField[field]) {
      extras.push(`${header}: ${clean}`);
    } else {
      byField[field] = clean;
    }
  }

  const notesParts = [byField.notes, ...extras].filter(Boolean);
  const buyer_name = byField.buyer_name ?? null;

  // "Enough to identify a real buyer contact": a name AND at least one way
  // to reach them or know what they buy — mirrors the Leads validity bar
  // (name + one identifying signal), scoped to what buyers.buyer_name (NOT
  // NULL) actually requires.
  const hasContactInfo = Boolean(byField.phone || byField.email || byField.company_name || byField.areas);
  let valid = true;
  let skip_reason: string | null = null;

  if (!buyer_name) {
    valid = false;
    skip_reason = "Missing buyer/investor name";
  } else if (!hasContactInfo) {
    valid = false;
    skip_reason = "Missing phone, email, company, and buy areas — not enough to identify this buyer";
  }

  return {
    buyer_name,
    company_name: byField.company_name ?? null,
    phone: byField.phone ?? null,
    email: byField.email ?? null,
    areas: byField.areas ?? null,
    property_types: byField.property_types ?? null,
    max_purchase_price: parseMoney(byField.max_purchase_price),
    max_repair_level: byField.max_repair_level ?? null,
    funding_type: normalizeFundingType(byField.funding_type ?? null),
    proof_of_funds_status: byField.proof_of_funds_status ?? null,
    typical_closing_speed: byField.typical_closing_speed ?? null,
    preferred_title_company: byField.preferred_title_company ?? null,
    notes: notesParts.length ? notesParts.join("\n") : null,
    raw: row,
    valid,
    skip_reason,
  };
}
