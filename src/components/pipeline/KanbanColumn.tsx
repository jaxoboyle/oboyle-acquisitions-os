import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { Lead } from "@/lib/types";
import { LeadCard } from "./LeadCard";

export function KanbanColumn({
  stageId,
  label,
  leads,
  onCardClick,
  onAddClick,
}: {
  stageId: string;
  label: string;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  onAddClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId, data: { type: "column", stage: stageId } });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-surface-hover/60">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-text">{label}</span>
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
            {leads.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
          title={`Add lead to ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-3 ${isOver ? "bg-accent-soft/40" : ""}`}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-[12px] text-text-muted">
            No leads
          </div>
        )}
      </div>
    </div>
  );
}
