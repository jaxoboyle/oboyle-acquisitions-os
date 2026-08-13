"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useWorkSession } from "@/lib/store/work-session";

export function ClockOutNoteModal() {
  const open = useWorkSession((s) => s.clockOutNoteOpen);
  const closeClockOutNote = useWorkSession((s) => s.closeClockOutNote);
  const clockOut = useWorkSession((s) => s.clockOut);

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function finish(withNote: boolean) {
    setSubmitting(true);
    await clockOut(withNote ? note.trim() || undefined : undefined);
    setSubmitting(false);
    setNote("");
  }

  return (
    <Modal
      title="Clock Out"
      description="Quick note on what you got done today? (optional)"
      onClose={closeClockOutNote}
      closeDisabled={submitting}
    >
      <div className="space-y-4">
        <textarea
          className="input text-sm min-h-[80px]"
          placeholder="What did you accomplish today?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
          autoFocus
        />
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary text-sm" onClick={() => finish(false)} disabled={submitting}>
            Skip
          </button>
          <button
            className="btn-primary flex items-center gap-1.5 text-sm border-danger/40"
            onClick={() => finish(true)}
            disabled={submitting}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Clock Out
          </button>
        </div>
      </div>
    </Modal>
  );
}
