import { BIG_STEIN_SYSTEM_PROMPT } from "./system-prompt-content";

/** Shared by every server-side Big Stein call site — chat, pipeline generation, proof
 * verification, and the EOD review all need the same identity and standards.
 * Appends today's date every call so relative dates ("in two weeks", "next
 * Friday") in follow-up scheduling resolve correctly without a tool round trip. */
export function loadBigSteinSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return `${BIG_STEIN_SYSTEM_PROMPT}\n\n---\n\n## Current Date\n\nToday's date is ${today}. Use this to resolve relative dates the user gives you (e.g. "tomorrow", "in two weeks", "next Monday") into ISO dates (YYYY-MM-DD) before calling any tool that takes a date.`;
}
