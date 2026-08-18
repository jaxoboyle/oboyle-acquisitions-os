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
      "Get today's, this week's, or this month's time-tracking summary: hours worked, category breakdown, productive vs nonproductive, unplanned/unplanned-work hours, and the specific tasks that consumed the most time (with their estimated vs actual minutes). Use this before giving productivity feedback or estimating how long similar future tasks will take — always cite the real numbers it returns, never invented ones.",
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

  // ── Seller-file import ──────────────────────────────────────────────────
  {
    name: "import_leads_from_file",
    description:
      "Commit a previously attached and parsed seller-list file into the Leads database. Call this when the user says things like 'add these sellers to my leads' or 'import this list' after attaching a CSV/XLSX/PDF/TXT file — the batch_id is given to you in the attached-file note in the conversation. Automatically skips rows missing required info and skips duplicates matched by parcel number, property address, or owner+address. Does not require confirmation — report the resulting counts (imported/duplicates/skipped) back to the user afterward exactly as returned.",
    input_schema: {
      type: "object" as const,
      properties: {
        batch_id: { type: "string", description: "The import batch UUID from the attached-file note." },
      },
      required: ["batch_id"],
    },
  },
  {
    name: "get_import_batches",
    description:
      "List recent seller-file import batches with their outcome counts, including how many of the leads from each batch are still active (not yet dispositioned). Use this to answer questions like 'how many sellers from yesterday's file became active leads?'",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max batches to return, default 10" },
      },
      required: [],
    },
  },

  // ── Disposition / follow-up ─────────────────────────────────────────────
  {
    name: "set_lead_disposition",
    description:
      "Cross a lead off as dealt with, or mark it for a callback. Valid dispositions: under_contract (creates a linked Deal automatically), follow_up (requires follow_up_date — schedules a callback and surfaces the lead on the Follow Ups view), not_interested, bad_lead, no_response, wrong_information, sold, other (requires a reason). This updates the SAME lead record — it never creates a duplicate. Low-risk for most dispositions, but always confirm with the user before calling with disposition='under_contract' since it creates a real Deal record.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string", description: "UUID of the lead (use search_leads first if you only have a name/address)." },
        disposition: {
          type: "string",
          enum: ["under_contract", "follow_up", "not_interested", "bad_lead", "no_response", "wrong_information", "sold", "other"],
        },
        reason: { type: "string", description: "Free-text reason. Required if disposition is 'other'." },
        notes: { type: "string" },
        follow_up_date: { type: "string", description: "ISO date (YYYY-MM-DD). Required if disposition is 'follow_up'." },
        contract_price: { type: "number", description: "Optional — contract price to seed the new Deal when disposition is under_contract." },
        confirmed: {
          type: "boolean",
          description: "Required and must be true when disposition is 'under_contract' — the user must explicitly confirm before a Deal is created.",
        },
      },
      required: ["lead_id", "disposition"],
    },
  },
  // ── Buyer-file import ────────────────────────────────────────────────────
  {
    name: "import_buyers_from_file",
    description:
      "Commit a previously attached and parsed buyer-list file into the Buyers database. Call this when the user says things like 'add these buyers to my list' or 'import these investors' after attaching a CSV/XLSX/PDF/TXT file — the batch_id is given to you in the attached-file note in the conversation. Automatically skips rows missing required info and skips duplicates matched by name+phone, name+email, phone, or email. Does not require confirmation — report the resulting counts (imported/duplicates/skipped) back to the user afterward exactly as returned.",
    input_schema: {
      type: "object" as const,
      properties: {
        batch_id: { type: "string", description: "The import batch UUID from the attached-file note." },
      },
      required: ["batch_id"],
    },
  },

  // ── General file intelligence ───────────────────────────────────────────
  {
    name: "read_attachment",
    description:
      "Read the content of a previously attached file (PDF, DOCX, CSV, XLSX, TXT, JSON, image/screenshot, PPTX, or RTF) by its attachment_id, given to you in the attached-file note in the conversation. Use this for ANY attachment intent that isn't a Leads/Buyers import — reading, summarizing, analyzing, running an ARV analysis, comparing files, answering a question about a document, or checking whether a file satisfies a task. For a very large document, pass `query` (the specific thing you're looking for, e.g. an address or topic) to get back the most relevant sections instead of the whole thing — omit it for a normal-sized document or when you need the full content. This never imports or changes any CRM data by itself.",
    input_schema: {
      type: "object" as const,
      properties: {
        attachment_id: { type: "string", description: "UUID from the attached-file note." },
        query: { type: "string", description: "Optional — narrows a large document to its most relevant sections." },
      },
      required: ["attachment_id"],
    },
  },
  {
    name: "list_attachments",
    description:
      "List files attached earlier in this conversation, with their attachment_id, filename, and type. Use this if the user refers back to a file ('the file I sent earlier', 'that spreadsheet') and you don't already have its attachment_id from the conversation history.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results, default 10" },
      },
      required: [],
    },
  },
  {
    name: "search_tasks",
    description:
      "Search the user's tasks by title/notes keyword, useful for finding the right task before attaching a file to it as proof (e.g. user says 'this is proof for my ARV task').",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term matched against title and notes." },
        limit: { type: "number", description: "Max results, default 10" },
      },
      required: ["query"],
    },
  },
  {
    name: "attach_file_to_task",
    description:
      "Attach a previously uploaded file to a task as completion proof and evaluate it against that task's actual proof requirement — exactly the same standard as the Complete Task screen, never a rubber stamp. Call this when the user says things like 'this is my proof for the ARV task', 'use this file to complete my task', 'does this satisfy today's task?', or 'attach this as proof'. If the proof is genuinely sufficient, the task is marked completed automatically (report this to the user). If not, nothing is marked complete — explain exactly what's missing from the tool's response so the user knows what to submit next. Never call this for a file the user is asking you to read/analyze/import instead — only when they're offering it as proof of completed work.",
    input_schema: {
      type: "object" as const,
      properties: {
        attachment_id: { type: "string", description: "UUID from the attached-file note." },
        task_id: { type: "string", description: "UUID of the task this is proof for (use search_tasks or get_today_tasks first if you only have a description)." },
        note: { type: "string", description: "Optional short written context from the user about what the file shows." },
      },
      required: ["attachment_id", "task_id"],
    },
  },

  // ── ARV / Cash Offer Calculator ─────────────────────────────────────────
  {
    name: "run_arv_analysis",
    description:
      "Run a full ARV/cash-offer analysis for a property address: looks up property facts and sold comps (if a property-data provider is configured), derives ARV low/likely/high with a confidence rating, and computes MAO and a suggested starting offer using the given (or default 75%/$15,000) buyer percentage and wholesale fee. Saves the result so it can be referenced later in this conversation or reopened in the ARV Calculator UI. If lead_id is given, links it to that lead immediately; otherwise it's unlinked until save_arv_analysis_to_lead is called. Use this for requests like 'run an ARV on 123 Main Street' or 'what's the MAO on this property'.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: { type: "string", description: "Property address to analyze." },
        lead_id: { type: "string", description: "Optional — UUID of the lead this analysis is for." },
        buyer_pct: { type: "number", description: "Buyer percentage, default 75." },
        wholesale_fee: { type: "number", description: "Wholesale fee in dollars, default 15000." },
      },
      required: ["address"],
    },
  },
  {
    name: "get_arv_analysis",
    description:
      "Get a previously saved ARV analysis — its property facts, ARV low/likely/high with confidence, comps used (with sources), repair estimate, buyer%/fee inputs, MAO, and suggested offer range. Use analysis_id if known, or lead_id to get that lead's most recent analysis. Use this to answer 'show me the comps used', 'why did you estimate ARV at $X', or to check current numbers before recalculating.",
    input_schema: {
      type: "object" as const,
      properties: {
        analysis_id: { type: "string" },
        lead_id: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "recalculate_mao",
    description:
      "Adjust one or more inputs on a saved ARV analysis (buyer percentage, wholesale fee, and/or a manual repair override) and recompute MAO and the suggested offer range using the exact same formula as the ARV Calculator UI — never estimate this yourself. Persists the change to that analysis. Use for 'what's my MAO if I want a $20k fee', 'change repairs to $50k', 'use 70% instead'.",
    input_schema: {
      type: "object" as const,
      properties: {
        analysis_id: { type: "string", description: "UUID from a prior run_arv_analysis or get_arv_analysis call." },
        buyer_pct: { type: "number" },
        wholesale_fee: { type: "number" },
        repairs_override: { type: "number", description: "Manual repair override in dollars. Pass null-like omission to leave unchanged." },
      },
      required: ["analysis_id"],
    },
  },
  {
    name: "save_arv_analysis_to_lead",
    description:
      "Link a previously run ARV analysis to a specific lead (use search_leads first if you only have a name/address) and update that lead's ARV/repairs/MAO snapshot fields. Use for 'save this to John Smith's lead'.",
    input_schema: {
      type: "object" as const,
      properties: {
        analysis_id: { type: "string" },
        lead_id: { type: "string" },
      },
      required: ["analysis_id", "lead_id"],
    },
  },

  {
    name: "list_followups",
    description:
      "Get leads currently marked follow_up, grouped by whether their follow-up date is overdue, today, or upcoming. Use for questions like 'which follow-ups do I have today?' or 'show me sellers I need to call back this week' (pass within_days: 7 for that).",
    input_schema: {
      type: "object" as const,
      properties: {
        bucket: { type: "string", enum: ["overdue", "today", "upcoming", "all"], description: "Default 'all'." },
        within_days: { type: "number", description: "When set, limits the 'upcoming' bucket to follow-ups due within this many days." },
      },
      required: [],
    },
  },
];
