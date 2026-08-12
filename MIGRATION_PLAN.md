# Migration Plan — SQLite to Supabase Postgres

Date: 2026-08-02  
Branch: feature/big-stein-operating-system

---

## Existing Data Location

| Item | Path |
|---|---|
| Live database | `%APPDATA%/com.jqobo.wholesale-crm/wholesale-crm.db` |
| Backup (pre-migration) | Session scratchpad — `wholesale-crm-backup-2026-08-02.db` |
| Automatic backups | `%APPDATA%/com.jqobo.wholesale-crm/backups/` |

The live database already has automatic daily backups managed by the Tauri app (30 retained). Do not disable this backup system.

---

## Migration Strategy

**Phase A — Schema creation in Supabase**
Write SQL migrations that define the Postgres schema. These are idempotent and safe to run multiple times.

**Phase B — Dry-run export**
Export SQLite data to JSON. Validate completeness. Confirm no data loss before touching Supabase.

**Phase C — Import to Supabase (staging first)**
Import to a staging Supabase project. Validate row counts, spot-check important records.

**Phase D — Validate and cut over**
If validation passes, import to production Supabase. Leave SQLite active until 2+ weeks of production use confirms stability.

**Phase E — Parallel operation**
The Tauri app continues writing to SQLite. A background sync job (or manual export → import) keeps Supabase updated until the Tauri app is upgraded to write to Supabase directly.

---

## Field Mapping: SQLite → Postgres

### leads

All existing columns map directly. Type changes:

| SQLite column | Postgres column | Type change |
|---|---|---|
| id (TEXT) | id (UUID) | Convert to UUID — existing TEXT UUIDs already valid |
| created_at (TEXT ISO8601) | created_at (TIMESTAMPTZ) | Parse and cast |
| updated_at (TEXT ISO8601) | updated_at (TIMESTAMPTZ) | Parse and cast |
| stage_order (REAL) | stage_order (NUMERIC) | No data loss |
| bedrooms (INTEGER) | bedrooms (INTEGER) | Same |
| square_footage (INTEGER) | square_footage (INTEGER) | Same |

New columns added (nullable, no migration risk):
- `user_id UUID REFERENCES auth.users` — set to the owner's Supabase UID during import

### buyers

All existing columns map directly. Same timestamp conversion.

New columns added:
- `user_id UUID REFERENCES auth.users`

### buyer_previous_deals

All existing columns map directly.

### deals

All existing columns map directly. Same timestamp conversion.

### documents

`stored_path` currently points to a local filesystem path inside `%APPDATA%/`. 

Migration plan:
1. During import, upload each file to Supabase Storage bucket `documents`.
2. Replace `stored_path` with the Supabase Storage public or signed URL.
3. Keep the original local path in a new nullable column `original_local_path` for reference.

If a file is missing from the local filesystem, log a warning and insert the record with `stored_path = NULL`. Do not abort the entire migration.

### tasks

All existing columns map directly.

### activity_log

All existing columns map directly.

### app_meta

Not migrated to Supabase. Replaced by `company_settings` table in Supabase.

---

## New Tables (No Migration Required)

These are net-new and have no SQLite equivalent:

- profiles
- company_settings
- objectives
- objective_metrics
- workdays
- time_entries
- clockout_reasons
- revenue_targets
- financial_entries
- chat_conversations
- chat_messages
- chat_attachments
- ai_tool_logs
- decisions
- blockers
- reports
- notifications
- push_subscriptions
- web_sources
- audit_logs
- task_evidence
- task_dependencies

---

## Migration Script Specification

`scripts/migrate-sqlite-to-supabase.ts`

```
Input:
  --db-path        Path to SQLite .db file
  --supabase-url   Supabase project URL
  --service-key    Supabase service role key (NOT anon key)
  --user-id        Supabase UID to assign ownership of all records
  --dry-run        Print counts and sample rows, do not write

Steps:
  1. Open SQLite with better-sqlite3
  2. Count rows in each table
  3. Export all rows to in-memory objects
  4. Validate required fields (seller_name not null, etc.)
  5. For each table, INSERT into Supabase in batches of 100
     using service role key (bypasses RLS for import)
  6. After import, re-count rows in Supabase and compare
  7. Write migration-report-{timestamp}.json:
     {
       sqlite_counts: { leads: N, buyers: N, ... },
       supabase_counts: { leads: N, buyers: N, ... },
       mismatches: [],
       warnings: [],
       duration_ms: N
     }

Error handling:
  - If Supabase insert fails for a row, log the error and continue
  - Do not abort the migration on individual row failures
  - Report all failures in the migration report
  - If > 10% of rows fail, abort and report as FAILED
```

---

## Validation Checklist

Before confirming migration is complete:

- [ ] Row counts match: leads
- [ ] Row counts match: buyers
- [ ] Row counts match: buyer_previous_deals
- [ ] Row counts match: deals
- [ ] Row counts match: tasks
- [ ] Row counts match: activity_log
- [ ] Row counts match: documents (note: files may not all be available)
- [ ] Spot-check 5 leads in Supabase vs original SQLite (name, stage, ARV match)
- [ ] Spot-check 3 deals (assignment_fee, closing_date match)
- [ ] Spot-check 3 buyers (areas, funding_type match)
- [ ] Dashboard stats in the web app match expected counts
- [ ] No records with NULL seller_name
- [ ] created_at and updated_at parsed to valid timestamps
- [ ] Foreign keys valid (deal.lead_id exists in leads, etc.)

---

## Rollback Plan

If the migration produces data corruption or validation failures:

1. Stop using the Supabase project (do not delete it)
2. The original SQLite database is untouched at `%APPDATA%/com.jqobo.wholesale-crm/wholesale-crm.db`
3. The Tauri app continues to work against the local SQLite database without any change
4. Fix the migration script and re-run against a fresh Supabase project
5. Do not delete the original Supabase project until the replacement is validated

---

## Parallel Operation Period

During the period when the Tauri app is still writing to SQLite and the web app is writing to Supabase:

- The Tauri app is the authoritative source for leads, buyers, deals, tasks
- The web app should show a notice: "Your desktop app is the current source of truth. Use the Data Sync feature in Settings to push new records to the cloud."
- A manual export button in the Settings page will export from SQLite and push to Supabase
- Automatic sync will be enabled once the Tauri frontend is updated to write to Supabase

---

## Timeline Estimate

| Step | Estimated Time |
|---|---|
| Write Supabase migrations | 2-3 hours |
| Write migration script | 2-3 hours |
| Test on staging Supabase | 1 hour |
| Run on production Supabase | 30 minutes |
| Validation | 30 minutes |
| **Total** | **~6-7 hours** |

---

## Credentials Required

| Credential | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS during import (never expose to client) |
| `SUPABASE_ANON_KEY` | Used by client apps after migration |

The `SUPABASE_SERVICE_ROLE_KEY` must only appear in:
- The migration script (run locally, not deployed)
- Supabase Edge Function environment variables (server only)

It must never appear in:
- Browser JavaScript bundles
- Tauri frontend code
- Next.js client components
- Git repository
