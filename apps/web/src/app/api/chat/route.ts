import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { BIG_STEIN_TOOLS } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/execute-tool";
import { loadBigSteinSystemPrompt } from "@/lib/ai/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check AI token budget
  const { data: settings } = await supabase
    .from("company_settings")
    .select("ai_monthly_token_limit, ai_tokens_used_this_month")
    .eq("user_id", user.id)
    .single();

  if (settings && settings.ai_monthly_token_limit > 0) {
    if (settings.ai_tokens_used_this_month >= settings.ai_monthly_token_limit) {
      return new Response(
        JSON.stringify({ error: "Monthly AI usage limit reached. Adjust in Settings." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const body = await req.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    conversationId?: string;
  };
  const { messages, conversationId } = body;

  if (!messages?.length) {
    return new Response("messages required", { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = loadBigSteinSystemPrompt();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      let fullResponse = "";
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      try {
        // Build the full request + tool loop
        const convMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let continueLoop = true;

        while (continueLoop) {
          const response = anthropic.messages.stream({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: convMessages,
            tools: BIG_STEIN_TOOLS,
          });

          // Stream text deltas
          response.on("text", (text) => {
            fullResponse += text;
            send({ type: "text", text });
          });

          // Wait for the complete message
          const finalMsg = await response.finalMessage();
          totalInputTokens += finalMsg.usage.input_tokens;
          totalOutputTokens += finalMsg.usage.output_tokens;

          if (finalMsg.stop_reason === "tool_use") {
            // Add assistant's response to conversation
            convMessages.push({ role: "assistant", content: finalMsg.content });

            // Execute all tool calls
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of finalMsg.content) {
              if (block.type !== "tool_use") continue;

              send({ type: "tool_start", name: block.name });

              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>,
                user.id,
                supabase,
                conversationId
              );

              // Log the tool call
              await supabase.from("ai_tool_logs").insert({
                user_id: user.id,
                conversation_id: conversationId ?? null,
                tool_name: block.name,
                input_params: block.input as Record<string, unknown>,
                result_summary: result.success ? "success" : (result.error ?? "error"),
                required_confirmation: result.requiresConfirmation ?? false,
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            }

            // Add tool results and continue loop
            convMessages.push({ role: "user", content: toolResults });
          } else {
            // end_turn or other stop reason — exit loop
            continueLoop = false;
          }
        }

        // Save assistant message to Supabase
        if (conversationId) {
          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: "assistant",
            content: fullResponse,
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
          });

          await supabase
            .from("chat_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
        }

        send({ type: "done", inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
      } catch (err) {
        console.error("[Big Stein chat error]", err);
        send({
          type: "error",
          message:
            err instanceof Anthropic.APIError
              ? `AI service error (${err.status}): ${err.message}`
              : "Big Stein is temporarily unavailable. Try again in a moment.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
