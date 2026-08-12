# Big Stein Operating System — Implementation Plan

Version: 1.0  
Date: 2026-08-02  
Branch: feature/big-stein-operating-system

---

## Project Goal

Transform the existing Wholesale CRM Tauri desktop application into **Big Stein** — a complete real estate company operating system available as a desktop app, secure web link, installable PWA, and browser dashboard, all sharing the same cloud-synced data.

---

## Architecture Decision

### Approach: Shared Frontend + Supabase Backend + Web App

The existing Tauri app will be preserved intact while a parallel Next.js web application is built. Both will share Supabase as their cloud database and authentication layer.

```
wholesale-crm/
  src/                        ← Existing Tauri frontend (kept, adapted)
  src-tauri/                  ← Existing Rust backend (kept, extended)
  apps/
    web/                      ← NEW: Next.js 15 web + PWA (Big Stein web)
  packages/
    types/                    ← Shared TypeScript types
    ui/                       ← Shared UI components (framework-agnostic)
    business-logic/           ← Shared validation, calculations
  supabase/
    migrations/               ← SQL migrations for Postgres
    functions/                ← Edge functions (AI proxy, push notifications)
    seed/                     ← Sample/initial data
  config/
    big-stein-system-prompt.md ← Big Stein AI identity and instructions
  .env.example                ← All required environment variables
  SECURITY.md
  DEPLOYMENT.md
  USER_GUIDE.md
  CHANGELOG.md
```

### Why This Approach

1. **No "big bang" rewrite** — The working Tauri app is not touched until Supabase is proven stable.
2. **PWA requirement** — Next.js with next-pwa delivers an installable PWA without an app store.
3. **Secure AI calls** — Next.js API routes keep the Anthropic key server-side.
4. **Shared types** — Both desktop and web import from `packages/types/`, preventing divergence.
5. **Platform adapters** — `api.ts` in the Tauri app and `api.ts` in the web app implement the same TypeScript interface; components don't know which is running.

---

## Required Credentials

The following must be provided before each phase can be tested end-to-end:

| Credential | Phase Needed | Where To Get It |
|---|---|---|
| `SUPABASE_URL` | Phase 1 | Supabase project dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Phase 1 | Supabase project dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 1 (server-side only) | Supabase project dashboard → Settings → API |
| `ANTHROPIC_API_KEY` | Phase 4 | console.anthropic.com |
| `ANTHROPIC_MODEL` | Phase 4 | Set to `claude-sonnet-4-6` or latest |
| `VAPID_PUBLIC_KEY` | Phase 5 | Generated with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Phase 5 | Generated with same command |
| `NEXT_PUBLIC_APP_URL` | Phase 5 | Your Vercel deployment URL |

---

## Development Phases

---

### PHASE 0 — AUDIT AND SAFETY ✅ COMPLETE

**Status: Done**

- [x] Full repository inspection
- [x] Existing schema documented (CURRENT_ARCHITECTURE.md)
- [x] Live SQLite database backed up to scratchpad
- [x] Git branch `feature/big-stein-operating-system` created
- [x] Architecture documents written
- [x] No existing files modified

---

### PHASE 1 — DATABASE AND AUTHENTICATION

**Goal**: Supabase Postgres schema, auth, Row Level Security, and data migration from SQLite.

**Tasks**:

1. Create `supabase/migrations/001_initial_schema.sql`
   - Mirror all existing SQLite tables in Postgres with UUID PKs
   - Add all new Big Stein tables (objectives, time_entries, chat, notifications, etc.)
   - Add Row Level Security policies on every table
   - Add indexes

2. Create `supabase/migrations/002_big_stein_tables.sql`
   - objectives (full hierarchy)
   - objective_metrics
   - workdays + time_entries + clockout_reasons
   - revenue_targets + financial_entries
   - chat_conversations + chat_messages + chat_attachments
   - ai_tool_logs
   - decisions, blockers
   - reports
   - notifications + push_subscriptions
   - documents (cloud)
   - web_sources
   - audit_logs
   - profiles + company_settings

3. Create `supabase/seed/initial_objectives.sql`
   - Insert 30-day $10K goal as first objective

4. Create `scripts/migrate-sqlite-to-supabase.ts`
   - Read from SQLite using better-sqlite3
   - Validate row counts before/after
   - Insert into Supabase with matching UUIDs
   - Produce migration report

5. Create `apps/web/` — Next.js 15 app
   - Supabase auth (email/password and magic link)
   - Protected routes
   - Session persistence

6. Update `wholesale-crm` Tauri frontend
   - Add `@supabase/supabase-js` as a dependency
   - Create platform adapter: `src/lib/platform.ts` with `isDesktop()` check
   - Wrap `api.ts` so Tauri commands and Supabase calls are selected at runtime

**Blockers without credentials**:
- Code can be written and type-checked
- Actual migration requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

**Files Created**:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_big_stein_tables.sql`
- `supabase/seed/initial_objectives.sql`
- `scripts/migrate-sqlite-to-supabase.ts`
- `apps/web/` (full Next.js scaffold)
- `.env.example`

---

### PHASE 2 — CORE OPERATING SYSTEM

**Goal**: Objective hierarchy, $10K financial target, daily/weekly planning.

**Tasks**:

1. `Objectives` module — 9-level hierarchy (15yr → 5yr → 3yr → Annual → 90day → Monthly → Weekly → Daily → Task)
   - CRUD UI for all levels
   - Parent-child visual connection
   - Progress % and success criteria fields

2. `$10K Dashboard Widget`
   - Collected / Contracted / Pipeline / Gap / Days remaining / Required pace / Current pace
   - Never display pipeline as earned

3. Daily planning system
   - Three non-negotiable outcomes per day
   - 10-hour Monday-Saturday block
   - 3-hour Sunday block
   - Task time estimates and deadlines

4. Weekly objective management
   - Auto-generated from current Monthly objective
   - Sunday review/planning trigger

5. Upgrade Dashboard page
   - Big Stein greeting section
   - Clock status widget
   - Today's 3 outcomes
   - Revenue progress bar

**Files Created**:
- `apps/web/src/app/objectives/`
- `apps/web/src/app/today/`
- `apps/web/src/components/objectives/`
- `apps/web/src/components/revenue/RevenueProgress.tsx`

---

### PHASE 3 — TIME AND ACCOUNTABILITY

**Goal**: Complete time tracking with clock-in/out, task timers, pause reasons, and weekly report.

**Tasks**:

1. Clock-in/out system
   - Clock-in button on Dashboard
   - Clock-out with reason required
   - Pause/resume with reason
   - Live timer display (hours worked today, hours remaining)

2. Task timers
   - Start/pause/resume/stop on individual tasks
   - Auto-switch on task change
   - Manual entry for offline work

3. Pause/clock-out reason system
   - 18 default reason types + custom
   - Optional explanation text
   - Store timestamp, duration, and reason

4. Daily performance score
   - Non-negotiable outcomes completed
   - Revenue-producing activity %
   - Follow-up completion %
   - CRM accuracy
   - Avoidable distraction time

5. Weekly time report
   - Hours by category
   - Top clock-out reasons by frequency and time consumed
   - Estimated vs actual task duration
   - Automation/delegation/removal candidates

**Files Created**:
- `apps/web/src/app/time-tracking/`
- `apps/web/src/components/timer/`
- `apps/web/src/components/clockout/`
- `apps/web/src/app/reports/`

---

### PHASE 4 — TEXT BIG STEIN

**Goal**: Streaming AI chat with secure server-side Anthropic API access and CRM tool use.

**Tasks**:

1. Big Stein system prompt
   - `config/big-stein-system-prompt.md`
   - Version-controlled, loaded at request time

2. Next.js API route `/api/chat`
   - Anthropic SDK (TypeScript, official)
   - Streaming responses via Server-Sent Events
   - Tool use: 20+ scoped CRM tools
   - Never expose API key to client

3. Chat UI
   - Message bubble layout (text-message style)
   - Streaming display
   - CRM record attachment chips
   - Quick-action buttons (7 default)
   - Source citation display

4. CRM Tools (server-side, authenticated, narrow scope)
   ```
   get_today_tasks, get_current_objectives, get_financial_progress,
   get_weekly_metrics, get_overdue_followups,
   get_lead, search_leads, get_buyer, search_buyers,
   get_property, search_properties, get_deal, search_deals,
   create_task, update_task, complete_task, reschedule_task,
   add_crm_note, create_followup, save_decision, record_blocker,
   get_time_summary, get_clockout_reason_summary,
   generate_weekly_report, search_uploaded_documents
   ```

5. Conversation persistence
   - `chat_conversations` + `chat_messages` in Supabase
   - Search, rename, archive, delete

6. Web research integration
   - Toggle: Auto / Ask / Manual / Disabled
   - Source citation with title, domain, URL, access date
   - Distinguish CRM sources vs web sources in UI

7. Token and cost tracking
   - Per-conversation token counts
   - Monthly usage limit with warning

8. Confirmation gates
   - High-impact tools require user confirmation before execution

**Files Created**:
- `config/big-stein-system-prompt.md`
- `apps/web/src/app/api/chat/route.ts`
- `apps/web/src/app/api/tools/` (each tool as a module)
- `apps/web/src/app/chat/`
- `apps/web/src/components/chat/`

---

### PHASE 5 — MOBILE PWA AND NOTIFICATIONS

**Goal**: Installable PWA, push notifications, progress check-ins.

**Tasks**:

1. PWA configuration
   - `next-pwa` or `@ducanh2912/next-pwa`
   - `manifest.json` with icons, theme color, display: standalone
   - Service worker registration
   - "Add to Home Screen" prompt handling

2. Push notification infrastructure
   - VAPID key generation instructions
   - Push subscription table in Supabase
   - Supabase Edge Function: `send-push-notification`
   - Permission request flow (shown only after user sees benefit)
   - Quiet hours (America/New_York default, editable)
   - Notification center (fallback when push blocked)

3. Scheduled notifications (Supabase scheduled jobs or pg_cron)
   - 07:00 Morning plan reminder
   - Task-start reminders (based on scheduled start)
   - Mid-task progress check-ins (for tasks > 30 min)
   - 17:00 Daily review nudge
   - Sunday 06:00 Weekly report trigger

4. Progress check-in flow
   - Notification opens to check-in modal
   - Response options: Completed / Still working / Blocked / Reschedule / Need help / Add note
   - Response updates the task and triggers Big Stein suggestion

5. Mobile UI polish
   - Touch-friendly timer controls (large tap targets)
   - Mobile-optimized sidebar (bottom nav on small screens)
   - Responsive card layouts
   - Swipe-friendly lead cards

**Files Created**:
- `apps/web/public/manifest.json`
- `apps/web/public/sw.js` (via next-pwa)
- `supabase/functions/send-push-notification/`
- `apps/web/src/app/api/push/`
- `apps/web/src/components/notifications/`

---

### PHASE 6 — REPORTING AND OPTIONAL MCP

**Goal**: Full reporting suite, PDF/CSV export, optional MCP server.

**Tasks**:

1. Daily report — tasks, hours, score, wins, blockers
2. Weekly report — full Sunday report spec
3. Monthly report — revenue actuals vs targets, objective review
4. 90-day report — strategic position check
5. PDF export — via `@react-pdf/renderer` or `puppeteer`
6. CSV export — numerical data for all reports

7. MCP server (optional, after all above is stable)
   - Simple HTTP server with JSON-RPC 2.0
   - Read tools: crm_get_today_tasks, crm_get_objectives, crm_search_leads, etc.
   - Write tools: crm_create_task, crm_add_note, crm_create_followup
   - Secure: requires Bearer token matching SUPABASE session
   - Audit-logged

**Files Created**:
- `apps/web/src/app/reports/`
- `apps/web/src/lib/pdf/`
- `packages/mcp-server/` (Phase 6 only)

---

## Component Reuse Strategy

Existing Tauri frontend components that can be reused or adapted:
- All `src/components/ui/` components — copy to `packages/ui/`
- `src/lib/types.ts` — base for `packages/types/`
- `src/lib/utils.ts` — `formatCurrency`, `formatDate`
- `src/lib/theme.tsx` — theme provider (works in browser too)

Tauri-specific code that must be isolated:
- `src/lib/api.ts` — all `invoke()` calls
- `src/components/leads/DocumentsPanel.tsx` — uses `documents_absolute_path`
- `src/pages/Settings.tsx` — uses `backup_now`, `list_backups`

---

## Testing Plan

Priority tests by phase:

**Phase 1**: Migration row counts, RLS blocking wrong user, auth required for protected routes  
**Phase 2**: $10K calculation (collected ≠ projected), objective parent-child link  
**Phase 3**: Timer start/pause/resume/stop, clock-out reason saving, daily total  
**Phase 4**: AI tool authorization, tool input validation, streaming works, key not in client bundle  
**Phase 5**: Push subscription saves, notification deduplication, quiet hours respected  
**Phase 6**: Weekly report SQL accuracy, PDF renders cleanly  

---

## Definition of Done

- [ ] Existing CRM data preserved and migrated to Supabase
- [ ] Tauri desktop app still launches and shows data
- [ ] Web app accessible at a URL with HTTPS
- [ ] PWA installable on phone from browser
- [ ] Desktop and mobile show same records
- [ ] $10K 30-day goal visible on dashboard
- [ ] Objective hierarchy connected (daily → weekly → monthly → 90day → annual → 3yr → 5yr → 15yr)
- [ ] Monday-Saturday 10-hour daily plan works
- [ ] Sunday 3-hour lighter plan works
- [ ] Clock-in, clock-out, pause/resume with reasons all save
- [ ] Weekly report identifies top time drains
- [ ] Text Big Stein streams responses
- [ ] Big Stein can read CRM records via tools
- [ ] Big Stein can create tasks and notes via tools
- [ ] Web research enabled with citations
- [ ] Push notifications ask about task progress
- [ ] ANTHROPIC_API_KEY not in client bundle (confirmed via build analysis)
- [ ] SUPABASE_SERVICE_ROLE_KEY not in client bundle
- [ ] RLS active on all user tables
- [ ] Type check passes
- [ ] Production build passes
- [ ] Setup instructions understandable to non-expert
