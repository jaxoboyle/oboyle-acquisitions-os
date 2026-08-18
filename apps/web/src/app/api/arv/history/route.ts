import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAnalysesForLead, listRecentAnalyses } from "@/lib/arv/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  const history = leadId
    ? await listAnalysesForLead(supabase, user.id, leadId)
    : await listRecentAnalyses(supabase, user.id);

  return NextResponse.json({ history });
}
