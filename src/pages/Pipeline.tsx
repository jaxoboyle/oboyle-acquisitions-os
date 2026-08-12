import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus, Search } from "lucide-react";
import { useLeads, useMoveLeadStage } from "@/hooks/useLeads";
import { STAGES, PRIORITIES, type Lead, type Priority } from "@/lib/types";
import { KanbanColumn } from "@/components/pipeline/KanbanColumn";
import { LeadCard } from "@/components/pipeline/LeadCard";
import { LeadFormDialog } from "@/components/leads/LeadFormDialog";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Columns = Record<string, Lead[]>;

function buildColumns(leads: Lead[]): Columns {
  const cols: Columns = {};
  for (const s of STAGES) cols[s.id] = [];
  for (const lead of leads) {
    if (!cols[lead.stage]) cols[lead.stage] = [];
    cols[lead.stage].push(lead);
  }
  for (const key of Object.keys(cols)) {
    cols[key].sort((a, b) => a.stageOrder - b.stageOrder);
  }
  return cols;
}

export function Pipeline() {
  const { data: leads, isLoading } = useLeads();
  const moveStage = useMoveLeadStage();

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [columns, setColumns] = useState<Columns>({});
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formStage, setFormStage] = useState<string | undefined>(undefined);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (priorityFilter && l.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        l.sellerName.toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q) ||
        (l.city ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, priorityFilter]);

  useEffect(() => {
    setColumns(buildColumns(filteredLeads));
  }, [filteredLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function findColumnOf(id: string): string | undefined {
    return Object.keys(columns).find((key) => columns[key].some((l) => l.id === id));
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const col = findColumnOf(id);
    if (col) setActiveLead(columns[col].find((l) => l.id === id) ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    const fromCol = findColumnOf(activeId);
    const toCol = findColumnOf(overId) ?? (over.data.current?.stage as string);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const fromItems = [...prev[fromCol]];
      const toItems = [...prev[toCol]];
      const activeIndex = fromItems.findIndex((l) => l.id === activeId);
      if (activeIndex === -1) return prev;
      const [moved] = fromItems.splice(activeIndex, 1);
      const overIndex = toItems.findIndex((l) => l.id === overId);
      const insertAt = overIndex === -1 ? toItems.length : overIndex;
      toItems.splice(insertAt, 0, moved);
      return { ...prev, [fromCol]: fromItems, [toCol]: toItems };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // By drag end, onDragOver has already relocated the active card into its
    // target column in local state — that's the source of truth for where it
    // landed, not the (possibly stale) stage recorded on whatever it was dropped onto.
    const col = findColumnOf(activeId);
    if (!col) return;

    setColumns((prev) => {
      const items = [...prev[col]];
      const oldIndex = items.findIndex((l) => l.id === activeId);
      const newIndex = items.findIndex((l) => l.id === overId);
      const reordered =
        oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex
          ? arrayMove(items, oldIndex, newIndex)
          : items;
      const next = { ...prev, [col]: reordered };

      const idx = reordered.findIndex((l) => l.id === activeId);
      const before = reordered[idx - 1];
      const after = reordered[idx + 1];
      let newOrder: number;
      if (before && after) newOrder = (before.stageOrder + after.stageOrder) / 2;
      else if (before) newOrder = before.stageOrder + 1;
      else if (after) newOrder = after.stageOrder - 1;
      else newOrder = Date.now();

      const lead = reordered[idx];
      if (lead && (lead.stage !== col || lead.stageOrder !== newOrder)) {
        moveStage.mutate({ id: activeId, stage: col, stageOrder: newOrder });
      }

      return next;
    });
  }

  return (
    <div className="flex h-full flex-col p-6 pb-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Seller Lead Pipeline</h1>
          <p className="text-sm text-text-muted">Drag leads between stages as deals progress.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setFormStage(undefined);
            setFormOpen(true);
          }}
        >
          <Plus size={15} /> Add Lead
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "")}
          className="w-40"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-6">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stageId={stage.id}
                label={stage.label}
                leads={columns[stage.id] ?? []}
                onCardClick={(lead) => setDetailLeadId(lead.id)}
                onAddClick={() => {
                  setFormStage(stage.id);
                  setFormOpen(true);
                }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead && <LeadCard lead={activeLead} onClick={() => {}} />}
          </DragOverlay>
        </DndContext>
      )}

      <LeadFormDialog open={formOpen} onClose={() => setFormOpen(false)} initialStage={formStage} />
      <LeadDetailDialog leadId={detailLeadId} onClose={() => setDetailLeadId(null)} />
    </div>
  );
}
