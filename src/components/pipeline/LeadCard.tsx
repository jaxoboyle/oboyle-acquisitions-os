import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MapPin, Phone, CalendarClock } from "lucide-react";
import type { Lead } from "@/lib/types";
import { PriorityBadge } from "@/components/ui/Badge";
import { cn, formatCurrency, formatDate, isPastDue, isDueToday } from "@/lib/utils";

export function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: "card", stage: lead.stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const followUpUrgent =
    lead.nextFollowUpDate && (isPastDue(lead.nextFollowUpDate) || isDueToday(lead.nextFollowUpDate));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab select-none rounded-md border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-text">{lead.sellerName}</span>
        <PriorityBadge priority={lead.priority} />
      </div>

      {lead.address && (
        <div className="mb-1 flex items-center gap-1 text-[12px] text-text-muted">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">
            {lead.address}
            {lead.city ? `, ${lead.city}` : ""}
          </span>
        </div>
      )}

      {lead.phone && (
        <div className="mb-1 flex items-center gap-1 text-[12px] text-text-muted">
          <Phone size={11} className="shrink-0" />
          <span className="truncate">{lead.phone}</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-text">
          {formatCurrency(lead.askingPrice ?? lead.offerAmount)}
        </span>
        {lead.nextFollowUpDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px]",
              followUpUrgent ? "font-medium text-danger" : "text-text-muted",
            )}
          >
            <CalendarClock size={11} />
            {formatDate(lead.nextFollowUpDate)}
          </span>
        )}
      </div>
    </div>
  );
}
