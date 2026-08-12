import { redirect } from "next/navigation";

// Root redirect — middleware handles auth, this catches direct / visits.
// Supabase falls back to the bare Site URL (this page) instead of
// /auth/callback when the exact redirect target isn't allow-listed, so a
// magic-link `code` can land here — forward it to the real exchange route
// instead of silently dropping it.
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  if (params.code) {
    const redirectTo = params.redirect ?? "/dashboard";
    redirect(
      `/auth/callback?code=${encodeURIComponent(params.code)}&redirect=${encodeURIComponent(redirectTo)}`
    );
  }
  redirect("/dashboard");
}
