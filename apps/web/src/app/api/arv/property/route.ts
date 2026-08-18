import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPropertyFacts, isPropertyDataConfigured, PropertyDataNotConfiguredError } from "@/lib/arv/property-data";

export const runtime = "nodejs";
export const maxDuration = 30;

// Fast, standalone lookup so the UI can show property facts immediately
// while /api/arv/comps (slower) is still running in parallel — spec section
// 26's "property facts can appear while comps are still analyzing."
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { address?: string } | null;
  const address = body?.address?.trim();
  if (!address) return NextResponse.json({ error: "Address is required." }, { status: 400 });

  if (!isPropertyDataConfigured()) {
    return NextResponse.json({ facts: null, configured: false, error: null });
  }

  try {
    const facts = await fetchPropertyFacts(address);
    return NextResponse.json({ facts, configured: true, error: facts ? null : "No property record found for that address." });
  } catch (err) {
    if (err instanceof PropertyDataNotConfiguredError) {
      return NextResponse.json({ facts: null, configured: false, error: null });
    }
    console.error("[arv/property] error", err);
    return NextResponse.json({ facts: null, configured: true, error: "Property lookup failed. You can still enter details manually." });
  }
}
