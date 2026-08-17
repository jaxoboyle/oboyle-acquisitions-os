import { z } from "zod";
import { requestBigSteinJson } from "@/lib/ai/json-call";

// Mode 4 — only reached when deterministic parsing (table / numbered-record
// / repeating-label detection) couldn't confidently find record boundaries.
// The model gets a COMPLETE chunk of the document's real text — never
// individual lines — and is asked to both find the records and extract
// them in one pass, since at this point boundary detection itself is the
// hard part, not just field extraction within an already-known block.

const LlmLeadSchema = z.object({
  seller_name: z.string().nullish(),
  address: z.string().nullish(),
  mailing_address: z.string().nullish(),
  city: z.string().nullish(),
  county: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  parcel_number: z.string().nullish(),
  asking_price: z.union([z.string(), z.number()]).nullish(),
  arv: z.union([z.string(), z.number()]).nullish(),
  occupancy: z.string().nullish(),
  repairs_needed: z.string().nullish(),
  lead_source: z.string().nullish(),
  notes: z.string().nullish(),
});
const LlmResponseSchema = z.object({ leads: z.array(LlmLeadSchema) });
type LlmLead = z.infer<typeof LlmLeadSchema>;

const CHUNK_SIZE = 8000;
const MAX_CHUNKS = 8; // hard ceiling — bounds worst-case cost/latency, not "per fragment" calls

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  // Split on paragraph/record-ish boundaries where possible so a chunk
  // boundary doesn't land mid-record.
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length > CHUNK_SIZE && current) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + p;
  }
  if (current) chunks.push(current);
  return chunks.slice(0, MAX_CHUNKS);
}

const INSTRUCTIONS = `You are extracting seller/property lead records from raw text extracted from a PDF real-estate opportunity report. The text may contain OCR/extraction artifacts, inconsistent line breaks, and labels sharing lines with their values.

Identify every distinct seller/property opportunity in the text — these are usually numbered, bulleted, or separated by consistent repeating labels like "Owner"/"Property Address". Extract what's genuinely present for each; use null for anything not stated. NEVER invent a name, address, phone, or price that isn't in the text. Preserve distress signals (foreclosure, tax delinquency, probate, vacancy, motivation) and any other useful detail in "notes" if there's no better field for it.

Respond with a JSON object: {"leads": [{"seller_name": string|null, "address": string|null, "mailing_address": string|null, "city": string|null, "county": string|null, "state": string|null, "zip": string|null, "phone": string|null, "email": string|null, "parcel_number": string|null, "asking_price": string|null, "arv": string|null, "occupancy": string|null, "repairs_needed": string|null, "lead_source": string|null, "notes": string|null}, ...]}`;

function llmLeadToRow(lead: LlmLead): Record<string, string> {
  const row: Record<string, string> = {};
  if (lead.seller_name) row["Owner"] = lead.seller_name;
  if (lead.address) row["Property Address"] = lead.address;
  if (lead.mailing_address) row["Mailing Address"] = lead.mailing_address;
  if (lead.city) row["City"] = lead.city;
  if (lead.county) row["County"] = lead.county;
  if (lead.state) row["State"] = lead.state;
  if (lead.zip) row["Zip"] = lead.zip;
  if (lead.phone) row["Phone"] = lead.phone;
  if (lead.email) row["Email"] = lead.email;
  if (lead.parcel_number) row["APN"] = lead.parcel_number;
  if (lead.asking_price != null) row["Asking Price"] = String(lead.asking_price);
  if (lead.arv != null) row["ARV"] = String(lead.arv);
  if (lead.occupancy) row["Occupancy"] = lead.occupancy;
  if (lead.repairs_needed) row["Repair Level"] = lead.repairs_needed;
  if (lead.lead_source) row["Source"] = lead.lead_source;
  if (lead.notes) row["Notes"] = lead.notes;
  return row;
}

/** Returns null if the LLM is unavailable, fails, or returns nothing
 * validatable — callers must fall through to the deterministic freeform
 * parser in that case, never insert unvalidated model output. */
export async function tryLlmExtraction(text: string): Promise<{ rows: Record<string, string>[]; warning: string } | null> {
  const chunks = chunkText(text);
  const allRows: Record<string, string>[] = [];
  let anySucceeded = false;

  for (const chunk of chunks) {
    const result = await requestBigSteinJson<unknown>({
      instructions: INSTRUCTIONS,
      userContent: chunk,
      maxTokens: 4096,
    });
    if (!result) continue;

    const parsed = LlmResponseSchema.safeParse(result);
    if (!parsed.success) continue;

    anySucceeded = true;
    for (const lead of parsed.data.leads) {
      const row = llmLeadToRow(lead);
      if (Object.keys(row).length > 0) allRows.push(row);
    }
  }

  if (!anySucceeded) return null;

  return {
    rows: allRows,
    warning: `No table, numbered records, or repeating labels were reliably detected — used AI extraction as a fallback and found ${allRows.length} candidate record(s). Review the preview carefully before importing.`,
  };
}
