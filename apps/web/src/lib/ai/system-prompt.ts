import { BIG_STEIN_SYSTEM_PROMPT } from "./system-prompt-content";

/** Shared by every server-side Big Stein call site — chat, pipeline generation, proof
 * verification, and the EOD review all need the same identity and standards. */
export function loadBigSteinSystemPrompt(): string {
  return BIG_STEIN_SYSTEM_PROMPT;
}
