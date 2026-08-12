import { requestBigSteinJson } from "./json-call";

type ProofType = "screenshot" | "file" | "url" | "written" | "number" | "call_count" | "crm_activity" | "summary" | "other";

type TaskForProof = {
  title: string;
  notes: string | null;
  task_type: string | null;
  category: string | null;
};

const KEYWORD_RULES: Array<{ pattern: RegExp; proof_type: ProofType; proof_required: string }> = [
  {
    pattern: /call|dial|phone|cold.?call/i,
    proof_type: "call_count",
    proof_required: "Report the number of calls made, contacts reached, and any follow-ups scheduled.",
  },
  {
    pattern: /study|read|review.*(agreement|contract|document)|learn|course|training/i,
    proof_type: "written",
    proof_required: "Write a short summary of what you learned and how it applies to a real deal.",
  },
  {
    pattern: /follow.?up/i,
    proof_type: "crm_activity",
    proof_required: "Log the outcome of the follow-up and the next scheduled contact date on the lead.",
  },
  {
    pattern: /offer|contract|analy[sz]e|comp|arv/i,
    proof_type: "number",
    proof_required: "Report the resulting number (offer amount, ARV, or MAO) and which property it's for.",
  },
  {
    pattern: /screenshot|photo|picture/i,
    proof_type: "screenshot",
    proof_required: "Attach a screenshot showing the completed work.",
  },
];

/**
 * Big Stein decides what reasonable proof looks like for a given task.
 * Cheap keyword heuristic first — only falls back to a model call for
 * ambiguous, user-authored tasks. Pipeline-generated tasks (see
 * lib/pipeline/replenish.ts) already carry proof_type/proof_required from
 * creation, so this mostly runs once per user-created task.
 */
export async function determineProofRequirement(
  task: TaskForProof
): Promise<{ proof_type: ProofType; proof_required: string }> {
  const haystack = `${task.title} ${task.notes ?? ""} ${task.task_type ?? ""} ${task.category ?? ""}`;

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(haystack)) {
      return { proof_type: rule.proof_type, proof_required: rule.proof_required };
    }
  }

  const result = await requestBigSteinJson<{ proof_type: ProofType; proof_required: string }>({
    instructions: `Decide what reasonable proof of completion should be required for this task. Pick the proof type that best fits — don't over-demand evidence for low-stakes tasks, and don't accept a vague claim for high-stakes ones.

Respond with a JSON object matching exactly this shape:
{"proof_type": "screenshot"|"file"|"url"|"written"|"number"|"call_count"|"crm_activity"|"summary"|"other", "proof_required": string (one sentence telling the operator exactly what to submit)}`,
    userContent: JSON.stringify({ title: task.title, notes: task.notes, task_type: task.task_type, category: task.category }),
    maxTokens: 256,
  });

  return result ?? { proof_type: "summary", proof_required: "Briefly describe what was done and the result." };
}
