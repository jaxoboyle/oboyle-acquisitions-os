import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore in read-only Server Components
          }
        },
      },
    }
  );
}

/**
 * `auth.getUser()` re-validates the session against Supabase's auth server —
 * a real network round trip, not a local cookie decode. The protected
 * layout and every page under it each called it independently, so a single
 * page load paid for that round trip 2-3 times before any data query even
 * started. `cache()` dedupes calls with identical arguments within one
 * request/render pass, so every caller below now shares one round trip.
 */
export const getAuthedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/** Service-role client — server-side only. Never expose to browser. */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
