import fs from "node:fs";
import path from "node:path";

const FALLBACK = `You are Big Stein, an AI real estate business operator and accountability boss.
Help the user run their wholesale real estate business by tracking leads, deals, tasks,
objectives, and finances. Be direct, analytical, and focused on execution.`;

/** Shared by every server-side Big Stein call site — chat, pipeline generation, proof
 * verification, and the EOD review all need the same identity and standards. */
export function loadBigSteinSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "..", "..", "config", "big-stein-system-prompt.md");
    return fs.readFileSync(promptPath, "utf-8");
  } catch {
    return FALLBACK;
  }
}
