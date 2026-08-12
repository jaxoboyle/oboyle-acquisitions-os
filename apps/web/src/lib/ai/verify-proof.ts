import { requestBigSteinJson, type ImageAttachment } from "./json-call";

type TaskForVerification = {
  title: string;
  notes: string | null;
  proof_required: string | null;
};

export type ProofSubmission = {
  proof_type: string;
  text?: string;
  number?: number;
  url?: string;
  file_paths?: string[];
};

/**
 * Big Stein reviews submitted proof against what the task actually required —
 * never rubber-stamps. Images are passed through as real vision input (see
 * requestBigSteinJson) so screenshot/file proof gets an actual visual check,
 * not just a presence check.
 */
export async function verifyProof(
  task: TaskForVerification,
  submission: ProofSubmission,
  images: ImageAttachment[] = []
): Promise<{ approved: boolean; reason: string }> {
  const result = await requestBigSteinJson<{ approved: boolean; reason: string }>({
    instructions: `You are reviewing proof of completion for a task, in your role as accountability boss. Never rubber-stamp — approve only if the submitted proof reasonably demonstrates the task was actually done. Reject vague, generic, or unsupported claims and say exactly what's missing. Do not be needlessly harsh on genuinely sufficient proof for a low-stakes task.

Respond with a JSON object matching exactly this shape:
{"approved": boolean, "reason": string (1-2 sentences: why approved, or exactly what's missing if rejected)}`,
    userContent: JSON.stringify({
      task_title: task.title,
      task_notes: task.notes,
      proof_required: task.proof_required,
      submission: {
        proof_type: submission.proof_type,
        text: submission.text ?? null,
        number: submission.number ?? null,
        url: submission.url ?? null,
        file_count: submission.file_paths?.length ?? 0,
      },
    }),
    images,
    maxTokens: 300,
  });

  if (!result) {
    // Anthropic unavailable or unparseable — never silently mark complete without review.
    return { approved: false, reason: "Big Stein couldn't reach the verification service — try submitting again in a moment." };
  }
  return result;
}
