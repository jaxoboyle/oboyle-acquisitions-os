"use client";

import { useMemo, useState } from "react";
import { PhoneCall, MapPin, CalendarClock, AlertTriangle, CalendarDays, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, todayISO } from "@/lib/utils";
import { LeadFormDialog, type LeadRecord } from "@/components/leads/LeadFormDialog";
import { LeadDispositionDialog } from "@/components/leads/LeadDispositionDialog";

function groupByBucket(leads: LeadRecord[]) {
  const today = todayISO();
  const overdue: LeadRecord[] = [];
  const dueToday: LeadRecord[] = [];
  const upcoming: LeadRecord[] = [];

  for (const lead of leads) {
    const due = lead.next_follow_up_date;
    if (!due || due < today) overdue.push(lead);
    else if (due === today) dueToday.push(lead);
    else upcoming.push(lead);
  }

  return { overdue, dueToday, upcoming };
}

export function FollowUpsClient({ leads }: { leads: LeadRecord[] }) {
  const [editing, setEditing] = useState<LeadRecord | null>(null);
  const [dispositioning, setDispositioning] = useState<LeadRecord | null>(null);
  const { overdue, dueToday, upcoming } = useMemo(() => groupByBucket(leads), [leads]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Follow Ups"
        description="Sellers you've scheduled to circle back with, organized by when they're due."
      />

      {leads.length === 0 ? (
        <div className="card p-0 overflow-hidden">
          <EmptyState
            icon={CalendarClock}
            title="No follow-ups scheduled"
            description="When you mark a lead Follow Up / Circle Back with a date, it will show up here."
          />
        </div>
      ) : (
        <>
          <FollowUpSection
            title="Overdue"
            icon={AlertTriangle}
            iconClassName="text-danger"
            leads={overdue}
            onOpen={setEditing}
            onComplete={setDispositioning}
          />
          <FollowUpSection
            title="Today"
            icon={CalendarDays}
            iconClassName="text-brand"
            leads={dueToday}
            onOpen={setEditing}
            onComplete={setDispositioning}
          />
          <FollowUpSection
            title="Upcoming"
            icon={Calendar}
            iconClassName="text-text-muted"
            leads={upcoming}
            onOpen={setEditing}
            onComplete={setDispositioning}
          />
        </>
      )}

      {editing && (
        <LeadFormDialog lead={editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />
      )}

      {dispositioning && (
        <LeadDispositionDialog
          lead={dispositioning}
          onClose={() => setDispositioning(null)}
          onSaved={() => setDispositioning(null)}
        />
      )}
    </div>
  );
}

function FollowUpSection({
  title,
  icon: Icon,
  iconClassName,
  leads,
  onOpen,
  onComplete,
}: {
  title: string;
  icon: React.ElementType;
  iconClassName?: string;
  leads: LeadRecord[];
  onOpen: (lead: LeadRecord) => void;
  onComplete: (lead: LeadRecord) => void;
}) {
  if (leads.length === 0) return null;

  return (
    <section className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <Icon size={15} className={iconClassName} />
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <span className="text-xs text-text-subtle">({leads.length})</span>
      </div>
      <ul className="divide-y divide-surface-border">
        {leads.map((lead) => (
          <li key={lead.id} className="px-5 py-3 flex items-start justify-between gap-4">
            <button onClick={() => onOpen(lead)} className="text-left min-w-0 group flex-1">
              <p className="font-medium text-text group-hover:text-brand transition-colors truncate">
                {lead.seller_name}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-text-muted">
                {lead.address && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {[lead.address, lead.city, lead.state].filter(Boolean).join(", ")}
                  </span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <PhoneCall size={11} /> {lead.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarClock size={11} /> {formatDate(lead.next_follow_up_date)}
                </span>
                {lead.lead_source && <span>Source: {lead.lead_source}</span>}
              </div>
              {lead.disposition_notes && (
                <p className="text-xs text-text-subtle mt-1 line-clamp-1">{lead.disposition_notes}</p>
              )}
            </button>
            <button onClick={() => onComplete(lead)} className="btn-secondary text-xs shrink-0">
              Complete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
