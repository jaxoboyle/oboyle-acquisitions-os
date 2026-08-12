import { useState } from "react";
import {
  Phone,
  MessageSquare,
  Mail,
  StickyNote,
  ArrowRightLeft,
  FileSignature,
  CalendarCheck,
  Paperclip,
  type LucideIcon,
} from "lucide-react";
import { useActivity, useAddActivity } from "@/hooks/useActivity";
import { ACTIVITY_TYPES } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  note: StickyNote,
  status_change: ArrowRightLeft,
  offer: FileSignature,
  appointment: CalendarCheck,
  document: Paperclip,
};

export function ActivityPanel({ leadId }: { leadId: string }) {
  const { data: activity, isLoading } = useActivity(leadId);
  const addActivity = useAddActivity(leadId);
  const [type, setType] = useState("note");
  const [text, setText] = useState("");

  function handleAdd() {
    if (!text.trim()) return;
    addActivity.mutate(
      { activityType: type, description: text.trim(), metadata: null },
      { onSuccess: () => setText("") },
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border p-3">
        <div className="mb-2 flex gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-48">
            {ACTIVITY_TYPES.filter((t) => t.id !== "status_change" && t.id !== "document").map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={addActivity.isPending}>
            Log Activity
          </Button>
        </div>
        <Textarea
          placeholder="What happened?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-16"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : !activity || activity.length === 0 ? (
        <EmptyState icon={StickyNote} title="No activity yet" description="Calls, texts, notes, and status changes will show up here." />
      ) : (
        <div className="space-y-3">
          {activity.map((a) => {
            const Icon = icons[a.activityType] ?? StickyNote;
            return (
              <div key={a.id} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon size={13} />
                </div>
                <div className="min-w-0 flex-1 border-b border-border pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium capitalize text-text-muted">
                      {a.activityType.replace("_", " ")}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-text-muted">
                      {formatDateTime(a.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-text">{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
