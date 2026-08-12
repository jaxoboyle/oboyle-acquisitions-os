import { createBrowserClient } from "@supabase/ssr";

// createClient returns SupabaseClient without a strict Database generic.
// Type safety comes from query-level type assertions; run
// `npx supabase gen types typescript --linked` after migrations are applied
// to get fully typed queries.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
