import Anthropic from "@anthropic-ai/sdk";
import { loadBigSteinSystemPrompt } from "./system-prompt";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type ImageAttachment = { mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; base64: string };

/**
 * One non-streaming Big Stein call that must answer with a single JSON object.
 * Shared by pipeline generation, proof-requirement, proof verification, and
 * the EOD review — every one of these needs the same identity/standards
 * (loadBigSteinSystemPrompt) but a structured answer instead of chat prose.
 */
export async function requestBigSteinJson<T>(opts: {
  instructions: string;
  userContent: string;
  images?: ImageAttachment[];
  maxTokens?: number;
}): Promise<T | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const system = `${loadBigSteinSystemPrompt()}\n\n---\n\n${opts.instructions}\n\nRespond with ONLY a single valid JSON object. No prose, no markdown code fences, no explanation outside the JSON.`;

  const content: Anthropic.MessageParam["content"] = [];
  for (const img of opts.images ?? []) {
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
  }
  content.push({ type: "text", text: opts.userContent });

  try {
    const message = await getClient().messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: opts.maxTokens ?? 1024,
      system,
      messages: [{ role: "user", content }],
    });

    const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as T;
  } catch (err) {
    console.error("[Big Stein JSON call error]", err);
    return null;
  }
}
