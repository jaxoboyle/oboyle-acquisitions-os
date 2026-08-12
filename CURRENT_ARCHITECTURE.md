# Current Architecture — Wholesale CRM

Audited: 2026-08-02  
Branch: feature/big-stein-operating-system

---

## Repository Location

`social-media-main/wholesale-crm/`

The wholesale-crm directory lives inside the social-media-main repository as an **untracked** subdirectory. It is a standalone Tauri 2.x desktop application for Windows.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Desktop framework | Tauri | 2.x |
| Frontend language | TypeScript | ~5.8 |
| Frontend framework | React | 19.x |
| Build tool | Vite | 7.x |
| Styling | Tailwind CSS | 4.x (Vite plugin, no config file) |
| Routing | React Router | 7.x |
| Data fetching | TanStack Query | 5.x |
| State management | Zustand | 5.x |
| Forms | react-hook-form + zod | 7.x / 4.x |
| Drag-and-drop | @dnd-kit | 6.x |
| Backend language | Rust | 2021 edition |
| Database | SQLite (via rusqlite bundled) | 0.32 |
| Serialization | serde / serde_json | 1.x |
| Date/time | chrono | 0.4 |
| IPC | Tauri invoke() | built-in |
| Authentication | None | — |
| Tests | None | — |

---

## Application Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Pipeline stats, upcoming closings |
| `/pipeline` | Pipeline | Kanban board with drag-and-drop stage management |
| `/deals` | Deal Tracker | Active deals with contract, title, and closing details |
| `/buyers` | Buyers | Cash buyer list with criteria and deal history |
| `/tasks` | Tasks | Follow-up and deadline tasks across all leads |
| `/settings` | Settings | Backup management, CSV import/export, data reset |

---

## Frontend Structure

```
src/
  App.tsx                        — Router and providers
  main.tsx                       — Entry point
  index.css                      — Tailwind base styles
  pages/
    Dashboard.tsx
    Pipeline.tsx
    DealTracker.tsx
    Buyers.tsx
    Tasks.tsx
    Settings.tsx
  components/
    layout/
      AppLayout.tsx              — Root layout with sidebar
      Sidebar.tsx
      ThemeToggle.tsx
    leads/
      LeadDetailDialog.tsx
      LeadFormDialog.tsx
      ActivityPanel.tsx
      DocumentsPanel.tsx
    buyers/
      BuyerFormDialog.tsx
    deals/
      DealDetailDialog.tsx
    pipeline/
      KanbanColumn.tsx
      LeadCard.tsx
    tasks/
      TaskFormDialog.tsx
    ui/
      Badge, Button, Card, ConfirmDialog, Dialog, EmptyState,
      Input, StatCard, Tabs, Toaster
  hooks/
    useLeads.ts
    useBuyers.ts
    useDeals.ts
    useTasks.ts
    useActivity.ts
    useDocuments.ts
  lib/
    api.ts                       — Tauri invoke() wrappers
    types.ts                     — TypeScript interfaces
    theme.tsx                    — Dark/light mode context
    toast.ts                     — Toast notification helper
    utils.ts                     — formatCurrency, formatDate
```

---

## Backend Structure (Rust)

```
src-tauri/src/
  main.rs                        — Entry point
  lib.rs                         — Tauri builder, plugin registration, command handler registration
  db.rs                          — DB init, backup, prune
  models.rs                      — Rust structs (Lead, Buyer, Deal, Task, Document, Activity…)
  error.rs                       — AppError / AppResult
  util.rs                        — Utilities
  schema.sql                     — SQLite schema (embedded at compile time)
  commands/
    leads.rs                     — leads_list, leads_get, leads_create, leads_update,
                                   leads_delete, leads_move_stage
    buyers.rs                    — buyers_list, buyers_create, buyers_update, buyers_delete
    deals.rs                     — deals_list, deals_get_by_lead, deals_upsert
    documents.rs                 — documents_list, documents_add, documents_delete,
                                   documents_absolute_path
    tasks.rs                     — tasks_list, tasks_create, tasks_update,
                                   tasks_set_completed, tasks_delete
    activity.rs                  — activity_list, activity_add
    dashboard.rs                 — dashboard_stats
    data.rs                      — get_data_dir, backup_now, list_backups,
                                   export_leads_csv, import_leads_csv,
                                   seed_sample_data, reset_all_data
    mod.rs                       — Module declarations
```

---

## SQLite Schema (Existing Tables)

### leads
Columns: id, stage, stage_order, seller_name, phone, email, preferred_contact_method, best_time_to_call, address, city, state, zip, parcel_number, property_type, bedrooms, bathrooms, square_footage, year_built, occupancy, reason_for_selling, desired_timeline, asking_price, mortgage_balance, known_liens, unpaid_taxes, property_condition, repairs_needed, conversation_notes, arv, estimated_repair_costs, mao, offer_amount, contract_price, buyer_price, estimated_assignment_fee, lead_source, priority, last_contact_date, next_follow_up_date, assigned_user, created_at, updated_at

Pipeline stages: new_lead, attempted_contact, contacted, follow_up, qualified_lead, appointment_scheduled, offer_sent, negotiating, under_contract, finding_buyer, sent_to_title, closing_scheduled, closed, dead_lead

### buyers
Columns: id, buyer_name, company_name, phone, email, areas, property_types, max_purchase_price, max_repair_level, funding_type, proof_of_funds_status, typical_closing_speed, preferred_title_company, notes, created_at, updated_at

### buyer_previous_deals
Columns: id, buyer_id (FK→buyers), property_address, deal_date, price, notes

### deals
Columns: id, lead_id (FK→leads, UNIQUE), contract_date, earnest_money_amount, earnest_money_due_date, inspection_period_end_date, closing_date, title_company_name/phone/email, end_buyer_id (FK→buyers), end_buyer_name, buyer_deposit, assignment_fee, title_status, closing_status, deal_notes, created_at, updated_at

### documents
Columns: id, lead_id (FK→leads), category, file_name, stored_path, uploaded_at

### tasks
Columns: id, lead_id (FK→leads, nullable), task_type, title, notes, due_date, completed, completed_at, created_at

### activity_log
Columns: id, lead_id (FK→leads), activity_type, description, metadata, created_at

### app_meta
Key-value store for application settings.

---

## Data Storage Locations

| Item | Location |
|---|---|
| Live SQLite database | `%APPDATA%/com.jqobo.wholesale-crm/wholesale-crm.db` |
| Automatic backups | `%APPDATA%/com.jqobo.wholesale-crm/backups/` (30 max) |
| Attached documents | `%APPDATA%/com.jqobo.wholesale-crm/documents/` |

---

## Key Tauri Plugins Active

- `tauri-plugin-opener` — Open files/URLs in native apps
- `tauri-plugin-dialog` — Native file picker dialogs
- `tauri-plugin-fs` and `tauri-plugin-shell` — Listed in package.json

---

## Theme System

Custom `ThemeProvider` using a `data-theme` attribute on `<html>`. Dark/light toggle stored in `localStorage`. Tailwind CSS custom properties drive the color palette. No shadcn/ui — fully custom components with consistent patterns.

---

## Critical Tauri Dependencies (Isolation Required)

All data access currently flows through `invoke()` from `@tauri-apps/api/core`. This is a Tauri-only API. Every hook (`useLeads`, `useBuyers`, etc.) calls `api.ts`, which calls `invoke()`.

To run the same frontend code in a browser or Next.js app, `invoke()` calls must be replaced with HTTP fetch calls to a web API. This is the central platform-adapter problem.

---

## What Works Well (Preserve)

- Full lead CRUD with pipeline stage management and drag-and-drop Kanban
- Complete deal tracking workflow (contract → title → closing)
- Cash buyer list with criteria matching
- Per-lead activity log and document attachments
- Task management with lead associations
- Daily automatic SQLite backup with 30-backup retention
- CSV import/export for leads
- Dark/light theme
- Clean, professional custom UI components

---

## What Is Missing (Big Stein Requirements)

- No authentication or multi-device access
- No cloud database or sync
- No web or mobile version
- No objective hierarchy or goal tracking
- No time tracking, clock-in/out, or work sessions
- No AI integration (Big Stein)
- No financial goal tracking ($10K target)
- No weekly/daily planning system
- No push notifications or PWA
- No reporting system
- No audit logging
- No MCP interface
