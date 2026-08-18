import Anthropic from "@anthropic-ai/sdk";
import { REPAIR_CATEGORIES } from "./repair-categories";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface RepairBreakdown {
  breakdown: Record<string, number>;
  total: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  narrative: string;
}

export interface RepairImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  base64: string;
}

/**
 * Estimates a repair-cost breakdown from property photos. This is an
 * estimate from VISIBLE condition only — it never claims to know hidden
 * plumbing/electrical/foundation/HVAC-internal condition from exterior
 * photos, per spec section 14. Returns null if no key is configured or
 * photos are supplied but the model call fails; callers should fall back to
 * a "no photos available" zero estimate with low confidence.
 */
export async function analyzeRepairPhotos(
  images: RepairImageInput[],
  context: { address: string; propertyType?: string | null; yearBuilt?: number | null; squareFootage?: number | null }
): Promise<RepairBreakdown | null> {
  if (!process.env.ANTHROPIC_API_KEY || images.length === 0) return null;

  const content: Anthropic.MessageParam["content"] = images.map((img) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
  }));

  content.push({
    type: "text",
    text: `You are estimating wholesale-flip repair costs for ${context.address} (${context.propertyType ?? "unknown type"}, built ${context.yearBuilt ?? "unknown year"}, ${context.squareFootage ?? "unknown"} sqft) from ${images.length} photo(s).

Look only at what is visibly shown. Categories: ${REPAIR_CATEGORIES.join(", ")}. For each category with visible evidence, estimate a dollar cost. Do NOT invent costs for categories with no visible evidence — omit them. Do NOT claim to know hidden plumbing, electrical, foundation, or HVAC-internal condition from exterior/surface photos alone; only flag "plumbing_electrical_visible" for things actually visible (exposed wiring, water stains, visible leaks).

Confidence should be "low" if fewer than 3 photos or mostly exterior-only, "medium" if a reasonable interior+exterior spread, "high" only with thorough interior coverage of kitchen/bath/systems areas.

Respond with ONLY a JSON object of this exact shape, no prose outside it:
{"breakdown": {"category_key": dollar_amount, ...}, "total": number, "confidence": "high"|"medium"|"low", "confidence_reason": "one short sentence", "narrative": "1-2 sentence summary of what was seen"}`,
  });

  try {
    const message = await getClient().messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      breakdown: Record<string, number>;
      total: number;
      confidence: "high" | "medium" | "low";
      confidence_reason: string;
      narrative: string;
    };

    const total =
      typeof parsed.total === "number"
        ? parsed.total
        : Object.values(parsed.breakdown ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);

    return {
      breakdown: parsed.breakdown ?? {},
      total,
      confidence: parsed.confidence ?? "low",
      confidenceReason: parsed.confidence_reason ?? "",
      narrative: parsed.narrative ?? "",
    };
  } catch (err) {
    console.error("[analyzeRepairPhotos] error", err);
    return null;
  }
}
