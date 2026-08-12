import type Anthropic from "@anthropic-ai/sdk";

// Narrowly scoped tools for Big Stein.
// Each tool reads/writes specific CRM data — no arbitrary SQL access.

export const BIG_STEIN_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_today_tasks",
    description:
      "Get all tasks scheduled for today, including non-negotiable outcomes, status, and time estimates.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_current_objectives",
    description:
      "Get the current active objectives at all levels (monthly, 90-day, weekly, daily) with progress percentages.",
    input_schema: {
      type: "object" as const,
      properties: {
        level: {
          type: "number",
          description: "Objective level 1-9. Omit to get all active objectives.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_financial_progress",
    description:
      "Get the current 30-day revenue target progress: collected, contracted, projected pipeline, gap, days remaining, and required weekly pace. NEVER conflate projected pipeline with earned revenue.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_weekly_metrics",
    description:
      "Get this week's key metrics: hours worked, revenue-producing hours, seller contacts, follow-ups, offers, properties analyzed.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_overdue_followups",
    description:
      "Get leads that have a past-due next_follow_up_date and have not been contacted.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum results to return. Default 10.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_lead",
    description: "Get full details for a specific lead by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string", description: "UUID of the lead" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "search_leads",
    description:
      "Search leads by seller name, address, phone, or stage. Returns summary info.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term" },
        stage: { type: "string", description: "Filter by pipeline stage (optional)" },
        limit: { type: "number", description: "Max results, default 10" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_buyer",
    description: "Get full details for a specific buyer by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        buyer_id: { type: "string", description: "UUID of the buyer" },
      },
      required: ["buyer_id"],
    },
  },
  {
    name: "search_buyers",
    description:
      "Search buyers by name, areas, property types, or funding type.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_deal",
    description: "Get full details for a specific deal by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_id: { type: "string", description: "UUID of the deal" },
      },
      required: ["deal_id"],
    },
  },
  {
    name: "search_deals",
    description: "Search active deals by status or seller name.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        closing_status: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task. This creates a DRAFT task that will be shown to the user for confirmation before saving, unless it is clearly low-risk (adding a follow-up note or reminder).",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        notes: { type: "string" },
        task_type: { type: "string" },
        due_date: { type: "string", description: "ISO date string" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
        is_revenue_producing: { type: "boolean" },
        estimated_minutes: { type: "number" },
        lead_id: { type: "string" },
        is_non_negotiable: { type: "boolean" },
      },
      required: ["title", "task_type"],
    },
  },
  {
    name: "update_task",
    description:
      "Update an existing task's status, notes, or due date. Requires confirmation for status changes to 'completed'.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string" },
        status: { type: "string" },
        notes: { type: "string" },
        due_date: { type: "string" },
        completion_pct: { type: "number" },
        blocker_description: { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "complete_task",
    description:
      "Mark a task as completed. REQUIRES user confirmation before executing. Do not call this without the user explicitly confirming completion and providing proof if required.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string" },
        proof: {
          type: "string",
          description: "Description of what was completed or evidence of completion",
        },
        actual_minutes: { type: "number" },
        confirmed: {
          type: "boolean",
          description: "Must be true — user has explicitly confirmed completion",
        },
      },
      required: ["task_id", "confirmed"],
    },
  },
  {
    name: "reschedule_task",
    description: "Reschedule a task to a new date with a reason.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string" },
        new_due_date: { type: "string" },
        reason: { type: "string" },
      },
      required: ["task_id", "new_due_date", "reason"],
    },
  },
  {
    name: "add_crm_note",
    description:
      "Add a note to a lead, buyer, or deal. Low-risk — does not require confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity_type: { type: "string", enum: ["lead", "buyer", "deal"] },
        entity_id: { type: "string" },
        note: { type: "string" },
        activity_type: { type: "string" },
      },
      required: ["entity_type", "entity_id", "note"],
    },
  },
  {
    name: "create_followup",
    description:
      "Create a follow-up reminder for a lead. Low-risk — creates a draft task.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
        follow_up_date: { type: "string" },
        notes: { type: "string" },
      },
      required: ["lead_id", "follow_up_date"],
    },
  },
  {
    name: "save_decision",
    description:
      "Save an important business decision made during the conversation to the CRM for future reference.",
    input_schema: {
      type: "object" as const,
      properties: {
        decision_text: { type: "string" },
        rationale: { type: "string" },
        lead_id: { type: "string" },
        deal_id: { type: "string" },
      },
      required: ["decision_text"],
    },
  },
  {
    name: "record_blocker",
    description: "Record a blocker that is preventing progress on a task or objective.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: { type: "string" },
        blocker_type: { type: "string" },
        task_id: { type: "string" },
        objective_id: { type: "string" },
      },
      required: ["description"],
    },
  },
  {
    name: "get_time_summary",
    description:
      "Get today's or this week's time-tracking summary: hours worked, category breakdown, productive vs nonproductive.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", enum: ["today", "week", "month"] },
      },
      required: [],
    },
  },
  {
    name: "get_clockout_reason_summary",
    description:
      "Get the most common clock-out and pause reasons this week or month, ranked by frequency and time consumed.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", enum: ["week", "month"] },
      },
      required: [],
    },
  },
];
