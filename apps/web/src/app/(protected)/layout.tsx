import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthedUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
