"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, MessageSquare, Loader2, AlertCircle, Search, Globe, Paperclip, X, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useWorkSession } from "@/lib/store/work-session";

type AttachedBatch = {
  batch_id: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
};

const ACCEPTED_IMPORT_TYPES = ".csv,.xlsx,.xls,.pdf,.txt";

type Conversation = {
  id: string;
  title: string;
  archived: boolean;
  total_tokens: number;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  tool_calls?: unknown;
  web_sources?: unknown;
  contains_assumptions?: boolean;
};

const QUICK_ACTIONS = [
  "What should I do next?",
  "Show today's priorities",
  "Am I on pace for $10,000?",
  "Show overdue follow-ups",
  "Prepare my call list",
  "Review my week",
  "Report a blocker",
] as const;

export function ChatClient({
  userId,
  initialConversations,
}: {
  userId: string;
  initialConversations: Conversation[];
}) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolActive, setToolActive] = useState<string | null>(null);
  const [attachedBatch, setAttachedBatch] = useState<AttachedBatch | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", activeConvId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data ?? []) as Message[]));
  }, [activeConvId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function createConversation(): Promise<string> {
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: userId, title: "New conversation" })
      .select()
      .single();
    if (error || !data) throw new Error("Failed to create conversation");
    setConversations((prev) => [data as Conversation, ...prev]);
    setActiveConvId(data.id);
    setMessages([]);
    return data.id;
  }

  async function uploadFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      let convId = activeConvId;
      if (!convId) convId = await createConversation();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", convId);

      const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
      const body = await res.json();

      if (!res.ok) {
        setUploadError(body.error ?? "Could not read that file.");
        return;
      }

      setAttachedBatch({
        batch_id: body.batch_id,
        filename: body.filename,
        total_rows: body.total_rows,
        valid_rows: body.valid_rows,
      });
      inputRef.current?.focus();
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  async function send(rawText: string) {
    if ((!rawText.trim() && !attachedBatch) || streaming) return;
    setError(null);

    const pendingBatch = attachedBatch;
    const text = pendingBatch
      ? `${rawText.trim() || "Add these sellers to my leads."}\n\n[Attached file: ${pendingBatch.filename} — import batch_id ${pendingBatch.batch_id}, ${pendingBatch.total_rows} rows parsed, ~${pendingBatch.valid_rows} look complete enough to import.]`
      : rawText;

    let convId = activeConvId;
    if (!convId) {
      convId = await createConversation();
    }

    // Save user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setAttachedBatch(null);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreamingText("");

    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      user_id: userId,
      role: "user",
      content: text,
    });

    // Build message history for API
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setStreaming(true);
    useWorkSession.getState().setBigSteinReviewing(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, conversationId: convId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "text") {
              accumulated += event.text;
              setStreamingText(accumulated);
            } else if (event.type === "tool_start") {
              setToolActive(event.name);
            } else if (event.type === "tool_thinking") {
              setToolActive("thinking...");
            } else if (event.type === "done") {
              setToolActive(null);
              // Add final assistant message to local state
              const assistantMsg: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: accumulated,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingText("");
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Connection error. Big Stein is temporarily unavailable.");
      }
    } finally {
      setStreaming(false);
      setToolActive(null);
      useWorkSession.getState().setBigSteinReviewing(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex h-full">
      {/* ── Conversation sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "border-r border-surface-border bg-bg flex flex-col shrink-0 transition-all duration-200",
          sidebarOpen ? "w-56" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-3 border-b border-surface-border">
          <button
            onClick={() => { createConversation(); }}
            className="btn-primary w-full flex items-center justify-center gap-2 text-xs"
          >
            <Plus size={13} />
            New conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-text-subtle text-center py-4 px-3">
              No conversations yet.
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs truncate transition-colors",
                  activeConvId === conv.id
                    ? "bg-brand-muted text-brand"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                )}
              >
                <div className="font-medium truncate">{conv.title}</div>
                <div className="text-[10px] text-text-subtle mt-0.5">
                  {formatRelative(conv.updated_at)}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main chat area ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-surface-border bg-surface shrink-0">
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="text-text-muted hover:text-text"
          >
            <MessageSquare size={16} />
          </button>
          <span className="text-sm font-serif font-semibold text-text">Big Stein</span>
          {toolActive && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" />
              {toolActive}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="max-w-lg mx-auto pt-8">
              <p className="text-sm text-text-muted text-center mb-6">
                Big Stein is ready. What&apos;s on your mind?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => send(action)}
                    className="text-left text-xs px-3 py-2 rounded border border-surface-border hover:border-brand/40 hover:bg-brand/5 text-text-muted hover:text-text transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Streaming message */}
          {streaming && streamingText && (
            <ChatMessage
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingText,
                created_at: new Date().toISOString(),
              }}
              isStreaming
            />
          )}

          {/* Tool indicator */}
          {streaming && !streamingText && toolActive && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 size={12} className="animate-spin" />
              Looking up {toolActive}…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className={cn("border-t border-surface-border p-3 bg-surface shrink-0", dragActive && "bg-brand/5")}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="max-w-3xl mx-auto">
            {uploadError && (
              <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2 mb-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {uploadError}
                <button onClick={() => setUploadError(null)} className="ml-auto text-text-subtle hover:text-text">
                  <X size={12} />
                </button>
              </div>
            )}

            {attachedBatch && (
              <div className="flex items-center gap-2 text-xs bg-brand-muted text-brand rounded px-3 py-2 mb-2">
                <FileText size={13} className="shrink-0" />
                <span className="truncate">
                  {attachedBatch.filename} — {attachedBatch.total_rows} rows parsed
                  {attachedBatch.valid_rows < attachedBatch.total_rows &&
                    ` (${attachedBatch.total_rows - attachedBatch.valid_rows} may be incomplete)`}
                </span>
                <button
                  onClick={() => setAttachedBatch(null)}
                  className="ml-auto text-brand/70 hover:text-brand shrink-0"
                  aria-label="Remove attachment"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {dragActive && (
              <div className="text-center text-xs text-brand border-2 border-dashed border-brand/40 rounded py-3 mb-2">
                Drop a CSV, XLSX, PDF, or TXT lead list to attach
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMPORT_TYPES}
                className="hidden"
                onChange={handleFileInputChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || uploading}
                className="btn-secondary shrink-0 p-2.5"
                aria-label="Attach a seller file"
                title="Attach a seller list (CSV, XLSX, PDF, TXT)"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachedBatch ? "Add a note, or send to import…" : "Message Big Stein…"}
                rows={1}
                className="input resize-none max-h-32 overflow-y-auto"
                style={{ height: "auto" }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
                }}
                disabled={streaming}
              />
              <button
                onClick={() => send(input)}
                disabled={(!input.trim() && !attachedBatch) || streaming}
                className="btn-primary shrink-0 p-2.5"
              >
                {streaming ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-text-subtle text-center mt-1.5">
            Big Stein organizes information — not legal or financial advice. Attach a CSV, XLSX, PDF, or TXT lead list to import sellers.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-brand text-brand-text"
            : "bg-surface border border-surface-border text-text"
        )}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-text-muted animate-pulse ml-0.5 align-middle" />
        )}
        {message.contains_assumptions && (
          <div className="mt-2 text-[10px] text-warning flex items-center gap-1">
            <AlertCircle size={10} />
            Contains assumptions — verify before acting
          </div>
        )}
        {!isUser && (
          <div className="mt-1 text-[10px] text-text-subtle">
            {formatRelative(message.created_at)}
          </div>
        )}
      </div>
    </div>
  );
}
