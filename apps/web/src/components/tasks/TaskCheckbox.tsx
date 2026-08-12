"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CompleteTaskModal, type TaskForModal } from "./CompleteTaskModal";

type TaskCheckboxTask = TaskForModal & { completed: boolean };

export function TaskCheckbox({ task }: { task: TaskCheckboxTask }) {
  const [pending, setPending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  // Un-completing is a correction the user is making to their own record, not
  // a completion claim — it stays instant. Marking complete is the action the
  // proof-of-completion system gates, so it opens the modal instead.
  async function uncomplete() {
    setPending(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ completed: false, status: "not_started", completed_at: null })
      .eq("id", task.id);
    setPending(false);
    window.dispatchEvent(new Event("oaos:tasks-changed"));
    router.refresh();
  }

  function handleCompleted() {
    setModalOpen(false);
    window.dispatchEvent(new Event("oaos:tasks-changed"));
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => (task.completed ? uncomplete() : setModalOpen(true))}
        disabled={pending}
        className={cn("shrink-0 transition-opacity mt-0.5", pending && "opacity-40")}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        {task.completed ? (
          <CheckCircle2 size={18} className="text-success" />
        ) : (
          <Circle size={18} className="text-text-subtle hover:text-brand transition-colors" />
        )}
      </button>
      {modalOpen && (
        <CompleteTaskModal task={task} onClose={() => setModalOpen(false)} onCompleted={handleCompleted} />
      )}
    </>
  );
}
