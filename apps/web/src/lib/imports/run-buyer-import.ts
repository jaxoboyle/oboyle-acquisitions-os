import { normalizeName, normalizePhone } from "./normalize";
import type { BuyerCandidate } from "./buyer-normalize-row";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

export type BuyerImportSummary = {
  imported_count: number;
  duplicate_count: number;
  skipped_count: number;
  total_rows: number;
  skipped_reasons: Array<{ row: string; reason: string }>;
  imported_buyer_ids: string[];
};

/** Commits a staged import batch into Buyers — the buyer-list counterpart to
 * lib/imports/run-import.ts. Separate function, separate dedupe rules (no
 * parcel/address concept for a buyer), so nothing here can affect the Leads
 * import path. */
export async function runBuyerImport(
  userId: string,
  supabase: AnySupabaseClient,
  batchId: string
): Promise<{ success: boolean; error?: string; summary?: BuyerImportSummary }> {
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .select("id, status, parsed_rows, source_filename")
    .eq("id", batchId)
    .eq("user_id", userId)
    .single();

  if (batchError || !batch) return { success: false, error: "Import batch not found." };
  if (batch.status === "completed") {
    return {
      success: false,
      error: "This file has already been imported. Upload it again if you want to re-check it for new buyers.",
    };
  }

  const candidates = (batch.parsed_rows ?? []) as BuyerCandidate[];
  if (candidates.length === 0) {
    return { success: false, error: "No rows were parsed from this file." };
  }

  const { data: existingBuyers } = await supabase
    .from("buyers")
    .select("id, buyer_name, phone, email")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const byNamePhone = new Map<string, string>();
  const byNameEmail = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();

  for (const b of existingBuyers ?? []) {
    const name = normalizeName(b.buyer_name);
    const phone = normalizePhone(b.phone);
    const email = (b.email ?? "").trim().toLowerCase();
    if (name && phone) byNamePhone.set(`${name}|${phone}`, b.id);
    if (name && email) byNameEmail.set(`${name}|${email}`, b.id);
    if (email) byEmail.set(email, b.id);
    if (phone) byPhone.set(phone, b.id);
  }

  const toInsert: Record<string, unknown>[] = [];
  const skipped_reasons: Array<{ row: string; reason: string }> = [];
  let duplicate_count = 0;

  for (const candidate of candidates) {
    const rowLabel = candidate.buyer_name || candidate.company_name || "(unnamed row)";

    if (!candidate.valid) {
      skipped_reasons.push({ row: rowLabel, reason: candidate.skip_reason ?? "Missing required information" });
      continue;
    }

    const name = normalizeName(candidate.buyer_name);
    const phone = normalizePhone(candidate.phone);
    const email = (candidate.email ?? "").trim().toLowerCase();

    const isDuplicate =
      (name && phone && byNamePhone.has(`${name}|${phone}`)) ||
      (name && email && byNameEmail.has(`${name}|${email}`)) ||
      (email && byEmail.has(email)) ||
      (phone && byPhone.has(phone));

    if (isDuplicate) {
      duplicate_count++;
      continue;
    }

    toInsert.push({
      user_id: userId,
      buyer_name: candidate.buyer_name,
      company_name: candidate.company_name,
      phone: candidate.phone,
      email: candidate.email,
      areas: candidate.areas,
      property_types: candidate.property_types,
      max_purchase_price: candidate.max_purchase_price,
      max_repair_level: candidate.max_repair_level,
      funding_type: candidate.funding_type ?? "cash",
      proof_of_funds_status: candidate.proof_of_funds_status,
      typical_closing_speed: candidate.typical_closing_speed,
      preferred_title_company: candidate.preferred_title_company,
      notes: candidate.notes ? `${candidate.notes}\n\nImported from: ${batch.source_filename}` : `Imported from: ${batch.source_filename}`,
    });

    // Mark this row's identity as taken so a duplicate later in the same
    // file is caught too.
    if (name && phone) byNamePhone.set(`${name}|${phone}`, `pending:${toInsert.length}`);
    if (name && email) byNameEmail.set(`${name}|${email}`, `pending:${toInsert.length}`);
    if (email) byEmail.set(email, `pending:${toInsert.length}`);
    if (phone) byPhone.set(phone, `pending:${toInsert.length}`);
  }

  let imported_buyer_ids: string[] = [];
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase.from("buyers").insert(toInsert).select("id");
    if (insertError) {
      return { success: false, error: `Failed to save imported buyers: ${insertError.message}` };
    }
    imported_buyer_ids = (inserted ?? []).map((r: { id: string }) => r.id);
  }

  const summary: BuyerImportSummary = {
    imported_count: imported_buyer_ids.length,
    duplicate_count,
    skipped_count: skipped_reasons.length,
    total_rows: candidates.length,
    skipped_reasons,
    imported_buyer_ids,
  };

  await supabase
    .from("import_batches")
    .update({
      status: "completed",
      imported_count: summary.imported_count,
      duplicate_count: summary.duplicate_count,
      skipped_count: summary.skipped_count,
      skipped_reasons: summary.skipped_reasons,
      processed_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("user_id", userId);

  return { success: true, summary };
}
