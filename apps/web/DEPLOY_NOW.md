# Deploy OAOS to Vercel

Run every command from `apps/web` — that's the actual app; the repo root
also contains an unrelated legacy Tauri project.

## 1. First-time setup (once)

```bash
cd apps/web
vercel link
```

Answer the prompts: pick your Vercel scope/team, and when asked "Link to
existing project?" choose **No** to create a new one (or **Yes** if you
already created one in the dashboard). This creates `apps/web/.vercel/` —
that folder is what makes `apps/web` the deploy root, so the legacy Tauri
code at the repo root is never touched.

## 2. Set environment variables (once)

In the Vercel dashboard: **Project → Settings → Environment Variables**,
add each of these for the **Production** environment (values come from
your local `.env.local` — never commit that file):

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_MONTHLY_TOKEN_LIMIT`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Add after your first deploy, once you know the real URL:
- `NEXT_PUBLIC_APP_URL` — set to your production URL (e.g.
  `https://oaos.vercel.app`)

Optional, add later once Twilio carrier registration is approved:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

## 3. Deploy

```bash
cd apps/web
vercel --prod
```

Copy the printed URL — you'll need it for step 4.

## 4. Update Supabase (after every domain change)

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://<your-vercel-url>`
- **Redirect URLs**: add `https://<your-vercel-url>/auth/callback`

## 5. Redeploy after adding `NEXT_PUBLIC_APP_URL`

Env var changes don't apply to an already-built deployment:

```bash
vercel --prod
```

## Installing OAOS on your phone

1. Open your production URL in Safari (iPhone) or Chrome (Android).
2. Tap Share → **Add to Home Screen** (iPhone) or the install prompt / menu
   → **Install app** (Android/Chrome).
3. Open OAOS from the icon it created — not from the browser tab.
4. Sign in.
5. Settings → Notifications → **Enable Notifications**.
6. Tap **Send Test Push**.

Push notifications on iPhone only work from the Home Screen app icon, not
from a normal Safari tab — this is an iOS limitation, not a bug.
