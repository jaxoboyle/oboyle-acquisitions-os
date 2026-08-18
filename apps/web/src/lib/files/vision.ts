import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Vision/OCR fallback for scanned PDFs and images (screenshots, photos of
 * comps/contracts/repair estimates). Used only when normal text extraction
 * found little or no real text — a real vision pass over a clean text PDF
 * would just waste tokens re-deriving what pdf.js already read for free.
 *
 * PDFs are sent as a native `document` content block — Claude reads the
 * rendered pages directly, so this needs no local OCR library or PDF-to-image
 * rendering (which would require a canvas/native dependency this app
 * deliberately avoids). Result is meant to be cached by the caller
 * (file_attachments.extracted_text) so this only ever runs once per file.
 */
export async function extractWithVision(
  payload: { mediaType: string; base64: string },
  filename: string
): Promise<{ text: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const isPdf = payload.mediaType === "application/pdf";
  const content: Anthropic.MessageParam["content"] = isPdf
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: payload.base64 } },
        {
          type: "text",
          text: `Transcribe everything useful from this scanned document ("${filename}") for a real-estate wholesaling business record. Include all readable text verbatim (names, addresses, phone numbers, prices, dates, notes) preserving structure (tables, numbered records) as plain text. If a section is illegible, say so briefly rather than guessing. Do not summarize or omit content — this transcription is the only copy of the document's text the system will have.`,
        },
      ]
    : [
        {
          type: "image",
          source: { type: "base64", media_type: payload.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: payload.base64 },
        },
        {
          type: "text",
          text: `Transcribe and describe everything useful in this image ("${filename}") for a real-estate wholesaling business record. Include all readable text verbatim (addresses, prices, names, phone numbers, MLS/comp data, dates). If it's a screenshot of a listing, comp, contract, or repair estimate, capture the structured details plainly. If something is illegible, say so briefly rather than guessing.`,
        },
      ];

  try {
    const message = await getClient().messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    });

    const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return null;
    return { text: textBlock.text };
  } catch (err) {
    console.error("[extractWithVision] error", err);
    return null;
  }
}
