"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function TaskCheckbox({ id, completed }: { id: string; completed: boolean }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function toggle() {
    setPending(true);
    const supabase = createClient();
    const nowCompleted = !completed;
    await supabase
      .from("tasks")
      .update({
        completed: nowCompleted,
        status: nowCompleted ? "completed" : "not_started",
        completed_at: nowCompleted ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setPending(false);
    window.dispatchEvent(new Event("oaos:tasks-changed"));
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={cn("shrink-0 transition-opacity mt-0.5", pending && "opacity-40")}
      aria-label={completed ? "Mark incomplete" : "Mark complete"}
    >
      {completed ? (
        <CheckCircle2 size={18} className="text-success" />
      ) : (
        <Circle size={18} className="text-text-subtle hover:text-brand transition-colors" />
      )}
    </button>
  );
}
