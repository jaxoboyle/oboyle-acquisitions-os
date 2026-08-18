import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSaleComps, isPropertyDataConfigured, PropertyDataNotConfiguredError, type SaleCompCandidate } from "@/lib/arv/property-data";
import { selectComps, calculateArvFromComps, type SubjectProperty } from "@/lib/arv/comps";

export const runtime = "nodejs";
export const maxDuration = 45;

export interface CompsResponseItem extends SaleCompCandidate {
  similarityScore: number;
  included: boolean;
  pricePerSqft: number | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    address?: string;
    subject?: SubjectProperty;
  } | null;
  const address = body?.address?.trim();
  if (!address) return NextResponse.json({ error: "Address is required." }, { status: 400 });

  if (!isPropertyDataConfigured()) {
    return NextResponse.json({ comps: [], arv: null, configured: false, error: null });
  }

  const subject: SubjectProperty = body?.subject ?? {
    squareFootage: null,
    bedrooms: null,
    bathrooms: null,
    propertyType: null,
    yearBuilt: null,
  };

  try {
    const { comps: candidates } = await fetchSaleComps(address, {
      propertyType: subject.propertyType,
      bedrooms: subject.bedrooms,
      bathrooms: subject.bathrooms,
      squareFootage: subject.squareFootage,
    });

    const scored = selectComps(candidates, subject);
    const comps: CompsResponseItem[] = scored.map((c) => ({
      ...c,
      pricePerSqft: c.soldPrice && c.squareFootage ? Math.round((c.soldPrice / c.squareFootage) * 100) / 100 : null,
    }));

    const arv = calculateArvFromComps(
      comps.map((c) => ({
        soldPrice: c.soldPrice,
        squareFootage: c.squareFootage,
        similarityScore: c.similarityScore,
        included: c.included,
      })),
      subject.squareFootage
    );

    return NextResponse.json({ comps, arv, configured: true, error: comps.length === 0 ? "No comparable sales found for that address." : null });
  } catch (err) {
    if (err instanceof PropertyDataNotConfiguredError) {
      return NextResponse.json({ comps: [], arv: null, configured: false, error: null });
    }
    console.error("[arv/comps] error", err);
    return NextResponse.json({ comps: [], arv: null, configured: true, error: "Comp search failed. You can add comps manually." });
  }
}
