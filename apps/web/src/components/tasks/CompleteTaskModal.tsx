"use client";

import { useEffect, useState } from "react";
import { Loader2, X, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type TaskForModal = {
  id: string;
  title: string;
  notes?: string | null;
  category?: string | null;
  task_type?: string | null;
};

const PROOF_LABEL: Record<string, string> = {
  screenshot: "Screenshot",
  file: "File",
  url: "Link",
  written: "Written explanation",
  number: "Number / result",
  call_count: "Call count",
  crm_activity: "CRM activity",
  summary: "Short summary",
  other: "Proof",
};

function inputKind(proofType: string | null): "text" | "number" | "url" | "file" {
  if (proofType === "number" || proofType === "call_count") return "number";
  if (proofType === "url") return "url";
  if (proofType === "screenshot" || proofType === "file") return "file";
  return "text";
}

export function CompleteTaskModal({
  task,
  onClose,
  onCompleted,
}: {
  task: TaskForModal;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [loadingRequirement, setLoadingRequirement] = useState(true);
  const [proofType, setProofType] = useState<string | null>(null);
  const [proofRequired, setProofRequired] = useState("");

  const [text, setText] = useState("");
  const [numberVal, setNumberVal] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${task.id}/proof-requirement`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setProofType(d.proof_type ?? "summary");
        setProofRequired(d.proof_required ?? "Briefly describe what was done.");
      })
      .catch(() => {
        if (cancelled) return;
        setProofType("summary");
        setProofRequired("Briefly describe what was done.");
      })
      .finally(() => !cancelled && setLoadingRequirement(false));
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const kind = inputKind(proofType);
  const canSubmit =
    !submitting &&
    !loadingRequirement &&
    (kind === "text" ? text.trim().length > 0
      : kind === "number" ? numberVal.trim().length > 0
      : kind === "url" ? url.trim().length > 0
      : files.length > 0);

  async function handleSubmit() {
    setSubmitting(true);
    setRejectionReason(null);
    try {
      let filePaths: string[] | undefined;

      if (files.length) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const uploaded: string[] = [];
          for (const file of files) {
            const path = `${user.id}/${task.id}/${Date.now()}-${file.name}`;
            const { error } = await supabase.storage.from("task-proof").upload(path, file);
            if (!error) uploaded.push(path);
          }
          filePaths = uploaded.length ? uploaded : undefined;
        }
      }

      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof_type: proofType,
          text: kind === "text" ? text.trim() : undefined,
          number: kind === "number" ? Number(numberVal) : undefined,
          url: kind === "url" ? url.trim() : undefined,
          file_paths: filePaths,
        }),
      });
      const data = await res.json();

      if (data.approved) {
        onCompleted();
      } else {
        setRejectionReason(data.reason ?? data.error ?? "Proof was not accepted.");
      }
    } catch {
      setRejectionReason("Something went wrong submitting proof — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80" onClick={submitting ? undefined : onClose} />
      <div className="relative card w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text">Complete task</h2>
            <p className="text-sm text-text-muted mt-0.5">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {loadingRequirement ? (
          <div className="flex items-center justify-center py-10 text-text-muted gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Big Stein is deciding what proof this needs…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded border border-surface-border bg-bg-muted p-3">
              <span className="label-tech">{PROOF_LABEL[proofType ?? "other"] ?? "Proof required"}</span>
              <p className="text-sm text-text mt-1">{proofRequired}</p>
            </div>

            {kind === "text" && (
              <textarea
                className="input text-sm w-full min-h-[100px]"
                placeholder="Describe what you did…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={submitting}
              />
            )}

            {kind === "number" && (
              <div className="space-y-2">
                <input
                  type="number"
                  className="input text-sm w-full"
                  placeholder={proofType === "call_count" ? "Calls made" : "Result"}
                  value={numberVal}
                  onChange={(e) => setNumberVal(e.target.value)}
                  disabled={submitting}
                />
                <textarea
                  className="input text-sm w-full min-h-[70px]"
                  placeholder="Contacts, leads, follow-ups, or other detail (optional)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={submitting}
                />
              </div>
            )}

            {kind === "url" && (
              <input
                type="url"
                className="input text-sm w-full"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={submitting}
              />
            )}

            {kind === "file" && (
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                multiple
                className="input text-sm w-full"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                disabled={submitting}
              />
            )}

            {rejectionReason && (
              <div className="flex items-start gap-2 rounded border border-danger/40 bg-danger/10 p-3">
                <XCircle size={15} className="text-danger shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-danger">Proof not accepted</p>
                  <p className="text-sm text-text-muted mt-0.5">{rejectionReason}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button className="btn-secondary text-sm" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                className={cn("btn-primary flex items-center gap-1.5 text-sm", !canSubmit && "opacity-50")}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {submitting ? "Verifying…" : "Submit proof"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
