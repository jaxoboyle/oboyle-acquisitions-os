# Security Guide — Big Stein Operating System

Date: 2026-08-02

---

## Secret Handling

| Secret | Where It Lives | Where It Must NEVER Appear |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server `.env.local` only | Browser bundle, client components, git |
| `ANTHROPIC_API_KEY` | Server `.env.local` only | Browser bundle, Tauri frontend, client components, git |
| `VAPID_PRIVATE_KEY` | Server `.env.local` only | Browser, git |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, browser-safe | Okay in browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, browser-safe | Restricted by RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local`, browser-safe | Okay in browser (by design) |

Verification: After any production build, run:
```
grep -r "sk-ant-" .next/    # must return nothing
grep -r "service_role" .next/  # must return nothing
```

---

## Database Permissions

Supabase Row Level Security is enabled on every table with user data. The fundamental policy:

> A user can only read and modify records where `user_id = auth.uid()`.

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is used only for:
1. The SQLite-to-Supabase migration script (runs locally, never deployed)
2. Supabase Edge Functions (server-side, not accessible to the browser)

The `SUPABASE_ANON_KEY` is safe to expose. RLS ensures it cannot access other users' data.

---

## AI Endpoint Security

The `/api/chat` route:
- Verifies the authenticated Supabase session on every request
- Rejects unauthenticated requests with 401
- Checks monthly token budget
- Never exposes the `ANTHROPIC_API_KEY` in responses
- Validates tool inputs before execution
- Limits each tool to the authenticated user's data
- Logs every tool call in `ai_tool_logs` with the user ID
- Requires explicit confirmation before completing high-impact actions (marking tasks done, closing deals)

The AI cannot execute arbitrary SQL. Every CRM interaction goes through named tool functions in `src/lib/ai/execute-tool.ts`.

---

## Push Notification Security

- VAPID keys generated with `npx web-push generate-vapid-keys`
- `VAPID_PRIVATE_KEY` stays server-side only
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is intentionally public (it authenticates the server to push services, not the user)
- Push subscriptions stored in `push_subscriptions` table with RLS — user can only see own subscriptions
- Notification content is never sensitive (it says "check your task", not "your assignment fee is $X")
- Users can unsubscribe and delete all subscriptions from Settings

---

## Authentication

- Email/password login and magic-link via Supabase Auth
- Session cookies managed by `@supabase/ssr` — HttpOnly, Secure, SameSite
- Middleware (`src/middleware.ts`) protects all routes except `/auth/*` and `/api/push`
- Server Components re-validate the session on every request
- No client-side-only session state

---

## File Upload Security

Documents are stored in Supabase Storage bucket `documents`:
- Bucket is private (not public)
- Upload requires authenticated session
- File path includes the user's UUID, preventing path traversal
- Allowed types: PDF, DOCX, DOC, JPG, JPEG, PNG, GIF, CSV, TXT, XLSX
- Maximum file size: 25MB per file
- File names are sanitized before storage

---

## Audit Logging

The `audit_logs` table records:
- Insert/update/delete on important records
- AI tool calls (all)
- High-impact confirmations
- Authentication events

Users can only read their own audit logs. They cannot delete or modify audit entries.

---

## What You Must Configure Before Production

1. Create a Supabase project at supabase.com
2. Run migrations: `supabase db push` (requires Supabase CLI)
3. Create the `documents` storage bucket in Supabase (set to private)
4. Add environment variables to Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `NEXT_PUBLIC_APP_URL`
5. Generate VAPID keys: `npx web-push generate-vapid-keys`
6. Enable Supabase Auth email confirmations (Settings → Auth → Email)
7. Set Supabase Auth redirect URL to your Vercel domain
8. Verify build contains no secrets: `grep -r "sk-ant-" .next/`

---

## Backup Strategy

- The Tauri desktop app creates daily backups at `%APPDATA%/com.jqobo.wholesale-crm/backups/` (30 retained)
- Supabase provides point-in-time recovery on Pro plans
- Run the migration export monthly as an additional backup
- The original SQLite database must be kept until Supabase data has been validated for 2+ weeks
