import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { ChatClient } from "./ChatClient";

export default async function ChatPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  // Load recent conversations
  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, title, archived, total_tokens, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(20);

  return <ChatClient userId={user.id} initialConversations={conversations ?? []} />;
}
