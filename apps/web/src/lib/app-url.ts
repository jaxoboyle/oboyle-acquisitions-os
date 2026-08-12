/**
 * Resolves the app's own public URL for server-side code that needs an
 * absolute link (e.g. in a future SMS/email body). Prefers an explicitly
 * set NEXT_PUBLIC_APP_URL (needed once a custom domain is in use), falls
 * back to Vercel's auto-provided VERCEL_URL on any Vercel deployment, and
 * finally to localhost for local dev.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
