import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEodReview } from "@/lib/ai/eod-review";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await generateEodReview(user.id, supabase);
  if (!result) {
    return NextResponse.json({ error: "Couldn't generate today's review — clock in first, or try again in a moment." }, { status: 400 });
  }

  return NextResponse.json(result);
}
