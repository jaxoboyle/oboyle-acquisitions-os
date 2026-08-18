// Fuzzy source-column → CRM-field mapping for Big Stein buyer-list imports.
// Mirrors column-map.ts's approach exactly (same normalization, same
// first-match-wins ordering) but targets the `buyers` table's fields instead
// of `leads` — kept as a separate file rather than parameterizing the
// existing one so the working Leads mapping can never be affected by a
// change made for buyers.

export type BuyerTargetField =
  | "buyer_name"
  | "company_name"
  | "phone"
  | "email"
  | "areas"
  | "property_types"
  | "max_purchase_price"
  | "max_repair_level"
  | "funding_type"
  | "proof_of_funds_status"
  | "typical_closing_speed"
  | "preferred_title_company"
  | "notes";

const BUYER_FIELD_ALIASES: Array<{ field: BuyerTargetField; aliases: string[] }> = [
  { field: "buyer_name", aliases: ["buyer", "buyer name", "name", "full name", "contact name", "contact", "investor", "investor name"] },
  { field: "company_name", aliases: ["company", "company name", "business", "business name", "entity"] },
  { field: "phone", aliases: ["phone", "phone number", "cell", "cell phone", "mobile", "telephone", "contact phone"] },
  { field: "email", aliases: ["email", "email address", "e mail"] },
  { field: "areas", aliases: ["areas", "buy areas", "buying areas", "market", "markets", "zip codes", "zips", "target areas", "coverage area"] },
  { field: "property_types", aliases: ["property types", "property type", "asset types", "asset type", "type", "types"] },
  { field: "max_purchase_price", aliases: ["max purchase price", "max price", "budget", "purchase price", "price range", "max offer"] },
  { field: "max_repair_level", aliases: ["max repair level", "repair level", "rehab level", "max rehab"] },
  { field: "funding_type", aliases: ["funding type", "funding", "financing", "funding source", "cash or financing"] },
  { field: "proof_of_funds_status", aliases: ["proof of funds", "pof", "proof of funds status"] },
  { field: "typical_closing_speed", aliases: ["closing speed", "typical closing speed", "days to close", "close time"] },
  { field: "preferred_title_company", aliases: ["title company", "preferred title company", "title co"] },
  { field: "notes", aliases: ["notes", "comments", "description", "remarks", "note"] },
];

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-/.]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapBuyerColumns(headers: string[]): Record<string, BuyerTargetField | null> {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: Record<string, BuyerTargetField | null> = {};
  const claimedFields = new Set<BuyerTargetField>();

  for (const { field, aliases } of BUYER_FIELD_ALIASES) {
    if (claimedFields.has(field)) continue;

    let match = normalizedHeaders.find((h) => !(h.raw in mapping) && aliases.includes(h.norm));

    if (!match) {
      match = normalizedHeaders.find((h) => {
        if (h.raw in mapping) return false;
        return aliases.some((a) => new RegExp(`\\b${a}\\b`).test(h.norm));
      });
    }

    if (match) {
      mapping[match.raw] = field;
      claimedFields.add(field);
    }
  }

  for (const h of headers) {
    if (!(h in mapping)) mapping[h] = null;
  }

  return mapping;
}
