import { buildDedupeIndex, findDuplicateLeadId, addToIndex, type ExistingLeadKey } from "./dedupe";
import type { LeadCandidate } from "./normalize-row";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

export type ImportSummary = {
  imported_count: number;
  duplicate_count: number;
  skipped_count: number;
  total_rows: number;
  skipped_reasons: Array<{ row: string; reason: string }>;
  imported_lead_ids: string[];
};

/** Commits a staged import batch: dedupes each parsed row against the
 * user's existing leads (and against rows already accepted earlier in the
 * same file), inserts everything that's left, and marks the batch
 * completed. This is what runs when the user tells Big Stein "add these to
 * my leads" — the parsing/staging step (upload route) already happened. */
export async function runImport(
  userId: string,
  supabase: AnySupabaseClient,
  batchId: string
): Promise<{ success: boolean; error?: string; summary?: ImportSummary }> {
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
      error: "This file has already been imported. Upload it again if you want to re-check it for new leads.",
    };
  }

  const candidates = (batch.parsed_rows ?? []) as LeadCandidate[];
  if (candidates.length === 0) {
    return { success: false, error: "No rows were parsed from this file." };
  }

  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, seller_name, address, parcel_number, phone")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const index = buildDedupeIndex((existingLeads ?? []) as ExistingLeadKey[]);

  const toInsert: Record<string, unknown>[] = [];
  const skipped_reasons: Array<{ row: string; reason: string }> = [];
  let duplicate_count = 0;

  for (const candidate of candidates) {
    const rowLabel = candidate.seller_name || candidate.address || "(unnamed row)";

    if (!candidate.valid) {
      skipped_reasons.push({ row: rowLabel, reason: candidate.skip_reason ?? "Missing required information" });
      continue;
    }

    const dupId = findDuplicateLeadId(candidate, index);
    if (dupId) {
      duplicate_count++;
      continue;
    }

    toInsert.push({
      user_id: userId,
      seller_name: candidate.seller_name,
      phone: candidate.phone,
      email: candidate.email,
      address: candidate.address,
      city: candidate.city,
      state: candidate.state,
      zip: candidate.zip,
      parcel_number: candidate.parcel_number,
      asking_price: candidate.asking_price,
      property_type: candidate.property_type,
      reason_for_selling: candidate.reason_for_selling,
      property_condition: candidate.property_condition,
      lead_source: candidate.lead_source ?? `Import: ${batch.source_filename}`,
      occupancy: candidate.occupancy,
      arv: candidate.arv,
      repairs_needed: candidate.repairs_needed,
      conversation_notes: candidate.conversation_notes,
      stage: "new_lead",
      priority: "medium",
      import_batch_id: batchId,
    });

    // Mark this row's identity as taken so a second row for the same
    // seller/address later in the same file is caught as a duplicate too.
    addToIndex(index, `pending:${toInsert.length}`, candidate);
  }

  let imported_lead_ids: string[] = [];
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert(toInsert)
      .select("id");

    if (insertError) {
      return { success: false, error: `Failed to save imported leads: ${insertError.message}` };
    }
    imported_lead_ids = (inserted ?? []).map((r: { id: string }) => r.id);

    await supabase.from("activity_log").insert(
      imported_lead_ids.map((leadId) => ({
        user_id: userId,
        lead_id: leadId,
        activity_type: "lead_imported",
        description: `Imported from ${batch.source_filename}`,
      }))
    );
  }

  const summary: ImportSummary = {
    imported_count: imported_lead_ids.length,
    duplicate_count,
    skipped_count: skipped_reasons.length,
    total_rows: candidates.length,
    skipped_reasons,
    imported_lead_ids,
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
