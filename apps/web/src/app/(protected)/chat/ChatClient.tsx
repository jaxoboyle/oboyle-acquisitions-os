"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, MessageSquare, Loader2, AlertCircle, Search, Globe, Paperclip, X, FileText, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useWorkSession } from "@/lib/store/work-session";

type ImportSample = { primary: string | null; secondary: string | null; phone: string | null; extra: string | null };

type PossibleImport = {
  batch_id: string;
  target_kind: "leads" | "buyers";
  total_rows: number;
  valid_rows: number;
  sample: ImportSample[];
};

type AttachedFile = {
  attachment_id: string;
  filename: string;
  file_kind: string;
  extraction_status: string;
  warnings: string[];
  possible_import: PossibleImport | null;
  importDeclined: boolean;
};

const ACCEPTED_ATTACH_TYPES = ".csv,.xlsx,.xls,.pdf,.txt,.docx,.json,.png,.jpg,.jpeg,.webp,.pptx,.rtf";

function fileNoteFor(f: AttachedFile): string {
  const parts = [`[Attached file: ${f.filename} — attachment_id ${f.attachment_id}, kind: ${f.file_kind}.`];
  if (f.extraction_status === "failed" || f.extraction_status === "unsupported") {
    parts.push(`Note: this file could not be read (${f.warnings[0] ?? "unsupported/unreadable"}).`);
  }
  if (f.possible_import && !f.importDeclined) {
    parts.push(
      `Also looks like it may contain a structured ${f.possible_import.target_kind === "buyers" ? "buyer" : "seller"} list — import batch_id ${f.possible_import.batch_id}, ${f.possible_import.valid_rows}/${f.possible_import.total_rows} rows look complete enough to import. Only import if the user's instruction actually asks for that.`
    );
  }
  return `${parts.join(" ")}]`;
}

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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [committingImport, setCommittingImport] = useState<string | null>(null);

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

      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      const body = await res.json();

      if (!res.ok) {
        setUploadError(body.error ?? "Could not read that file.");
        return;
      }

      setAttachedFiles((prev) => [
        ...prev,
        {
          attachment_id: body.attachment_id,
          filename: body.filename,
          file_kind: body.file_kind,
          extraction_status: body.extraction?.status ?? "pending",
          warnings: body.extraction?.warnings ?? [],
          possible_import: body.possible_import ?? null,
          importDeclined: false,
        },
      ]);
      inputRef.current?.focus();
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadFiles(files: File[]) {
    for (const file of files) {
      // Sequential, not parallel — keeps upload cards appearing in the order
      // the user picked them, and avoids hammering the route with a burst of
      // concurrent AI/OCR calls for a multi-file drop.
      await uploadFile(file);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) uploadFiles(files);
    e.target.value = "";
  }

  async function addSystemMessage(convId: string, content: string) {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      user_id: userId,
      role: "assistant",
      content,
    });
  }

  // Confirms the preview shown after upload — a direct, deterministic
  // commit (not routed through Big Stein/the LLM) so clicking "Import
  // Leads"/"Import Buyers" is instant and doesn't depend on the model
  // inferring intent. The natural-language path ("Add these sellers to my
  // leads") still works separately via the import_leads_from_file /
  // import_buyers_from_file tools.
  async function confirmImport(file: AttachedFile) {
    if (!file.possible_import || committingImport) return;
    const { batch_id, target_kind } = file.possible_import;
    setCommittingImport(file.attachment_id);
    try {
      const res = await fetch(`/api/imports/${batch_id}`, { method: "POST" });
      const summary = await res.json();
      setAttachedFiles((prev) => prev.map((f) => (f.attachment_id === file.attachment_id ? { ...f, importDeclined: true } : f)));

      let convId = activeConvId;
      if (!convId) convId = await createConversation();

      const noun = target_kind === "buyers" ? "buyer" : "lead";
      if (!res.ok) {
        await addSystemMessage(convId, `Couldn't import ${file.filename}: ${summary.error ?? "unknown error"}`);
        return;
      }

      const lines = [
        `**${summary.imported_count} new ${noun}${summary.imported_count === 1 ? "" : "s"} added**`,
        `**${summary.duplicate_count} duplicate${summary.duplicate_count === 1 ? "" : "s"} skipped**`,
      ];
      if (summary.skipped_count > 0) {
        lines.push(`**${summary.skipped_count} row${summary.skipped_count === 1 ? "" : "s"} could not be imported** because they were missing enough information.`);
      }
      await addSystemMessage(convId, lines.join("\n"));
    } catch {
      setUploadError("Import failed. Check your connection and try again.");
    } finally {
      setCommittingImport(null);
    }
  }

  // Declines the offered import without discarding the attachment — the
  // file stays available for reading/analysis/proof, only the staged
  // Leads/Buyers batch is torn down.
  async function declineImport(file: AttachedFile) {
    if (!file.possible_import) return;
    const batchId = file.possible_import.batch_id;
    setAttachedFiles((prev) => prev.map((f) => (f.attachment_id === file.attachment_id ? { ...f, importDeclined: true } : f)));
    try {
      await fetch(`/api/imports/${batchId}`, { method: "DELETE" });
    } catch {
      // Best-effort — the batch just sits unused if this fails, no harm done.
    }
  }

  function removeAttachedFile(attachmentId: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.attachment_id !== attachmentId));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) uploadFiles(files);
  }

  async function send(rawText: string) {
    if ((!rawText.trim() && attachedFiles.length === 0) || streaming) return;
    setError(null);

    const pendingFiles = attachedFiles;
    const fileNotes = pendingFiles.map(fileNoteFor).join("\n");
    // No synthetic "add these to my leads" default — an attachment with no
    // instruction is not an import instruction. Big Stein's system prompt
    // handles the empty-instruction case (read it / ask what to do).
    const text = [rawText.trim(), fileNotes].filter(Boolean).join("\n\n");

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
    setAttachedFiles([]);
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

            {attachedFiles.length > 0 && (
              <div className="space-y-2 mb-2">
                {attachedFiles.map((file) => (
                  <div key={file.attachment_id} className="card p-3 text-xs">
                    <div className="flex items-center gap-2 text-text">
                      <FileText size={13} className="shrink-0 text-brand" />
                      <span className="font-medium truncate">{file.filename}</span>
                      {file.extraction_status === "pending" && <span className="text-text-subtle">reading…</span>}
                      {file.extraction_status === "needs_vision" && <span className="text-text-subtle">attached — reads on first question</span>}
                      {(file.extraction_status === "failed" || file.extraction_status === "unsupported") && (
                        <span className="text-danger">{file.warnings[0] ?? "couldn't be read"}</span>
                      )}
                      <button
                        onClick={() => removeAttachedFile(file.attachment_id)}
                        className="ml-auto text-text-subtle hover:text-danger shrink-0"
                        aria-label={`Remove ${file.filename}`}
                        disabled={committingImport === file.attachment_id}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {file.possible_import && !file.importDeclined && (
                      <>
                        <p className="mt-1.5 text-text-muted">
                          Also looks like it may contain a structured {file.possible_import.target_kind === "buyers" ? "buyer" : "seller"} list — found{" "}
                          <span className="font-medium text-text">
                            {file.possible_import.valid_rows} record{file.possible_import.valid_rows === 1 ? "" : "s"}
                          </span>
                          {file.possible_import.total_rows > file.possible_import.valid_rows &&
                            ` (${file.possible_import.total_rows - file.possible_import.valid_rows} row${file.possible_import.total_rows - file.possible_import.valid_rows === 1 ? "" : "s"} look incomplete and may be skipped)`}
                        </p>

                        {file.possible_import.sample.length > 0 && (
                          <ul className="mt-2 space-y-1 border-t border-surface-border pt-2">
                            {file.possible_import.sample.map((r, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-text-muted">
                                <Users size={11} className="shrink-0 text-text-subtle" />
                                <span className="text-text truncate">{r.primary ?? "—"}</span>
                                {r.secondary && <span className="truncate">— {r.secondary}</span>}
                                {r.phone && <span className="shrink-0 text-text-subtle">{r.phone}</span>}
                                {r.extra && <span className="shrink-0 text-text-subtle">{r.extra}</span>}
                              </li>
                            ))}
                          </ul>
                        )}

                        <p className="mt-2 text-text-subtle">
                          This is optional — only import if that&apos;s what you want done with this file.
                        </p>
                        <div className="flex items-center justify-end gap-2 mt-1.5 pt-2 border-t border-surface-border">
                          <button
                            onClick={() => declineImport(file)}
                            className="btn-secondary text-xs px-3 py-1.5"
                            disabled={committingImport === file.attachment_id}
                          >
                            Not now
                          </button>
                          <button
                            onClick={() => confirmImport(file)}
                            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                            disabled={committingImport === file.attachment_id}
                          >
                            {committingImport === file.attachment_id && <Loader2 size={12} className="animate-spin" />}
                            Import {file.possible_import.target_kind === "buyers" ? "Buyers" : "Leads"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {dragActive && (
              <div className="text-center text-xs text-brand border-2 border-dashed border-brand/40 rounded py-3 mb-2">
                Drop a file to attach — PDF, CSV, XLSX, DOCX, TXT, JSON, or an image
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_ATTACH_TYPES}
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || uploading}
                className="btn-secondary shrink-0 p-2.5"
                aria-label="Attach a file"
                title="Attach a file — PDF, CSV, XLSX, DOCX, TXT, JSON, or an image"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachedFiles.length > 0 ? "Tell Big Stein what to do with this file…" : "Message Big Stein…"}
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
                disabled={(!input.trim() && attachedFiles.length === 0) || streaming}
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
            Big Stein organizes information — not legal or financial advice. Attach a file, then tell Big Stein what to do with it — read it, analyze it, import it, or use it as task proof.
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
