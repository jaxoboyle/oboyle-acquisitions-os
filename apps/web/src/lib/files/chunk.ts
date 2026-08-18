// Lightweight chunking + relevance selection for large extracted documents.
// No vector DB, no embeddings — a real-estate business document (contracts,
// comp reports, inspection reports) is small enough that keyword-overlap
// scoring over page/section-bounded chunks is enough to keep only the
// relevant part in the prompt, while always telling the model what was left
// out (never a silent truncation).

export type Chunk = { location: string; text: string };

const MAX_INLINE_CHARS = 60_000; // returned whole below this size
const CHUNK_TARGET_CHARS = 3_000;
const MAX_CHUNKS_RETURNED = 8;

/** Splits text on explicit page/section markers first (preserves real
 * document boundaries for citation), falling back to fixed-size windows for
 * text with no such markers (e.g. a DOCX with no page breaks). */
export function splitIntoChunks(text: string): Chunk[] {
  const pageMarker = /\n?--- (Page \d+|Sheet: .+) ---\n?/g;
  const parts = text.split(pageMarker);
  const markers = [...text.matchAll(pageMarker)].map((m) => m[1]);

  if (markers.length > 1) {
    // parts[0] is any preamble before the first marker; subsequent parts
    // align 1:1 with markers.
    const chunks: Chunk[] = [];
    if (parts[0]?.trim()) chunks.push({ location: "start", text: parts[0].trim() });
    for (let i = 0; i < markers.length; i++) {
      const body = (parts[i + 1] ?? "").trim();
      if (body) chunks.push({ location: markers[i], text: body });
    }
    return chunks.flatMap((c) => (c.text.length > CHUNK_TARGET_CHARS * 2 ? windowChunk(c) : [c]));
  }

  return windowChunk({ location: "document", text });
}

function windowChunk(chunk: Chunk): Chunk[] {
  if (chunk.text.length <= CHUNK_TARGET_CHARS * 1.5) return [chunk];
  const out: Chunk[] = [];
  let i = 0;
  let part = 1;
  while (i < chunk.text.length) {
    out.push({
      location: `${chunk.location} (part ${part})`,
      text: chunk.text.slice(i, i + CHUNK_TARGET_CHARS),
    });
    i += CHUNK_TARGET_CHARS;
    part++;
  }
  return out;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
}

/** Returns either the full text (small documents — the common case) or the
 * most relevant chunks for `query`, each labeled with its source location so
 * the model can cite where information came from. Always reports how many
 * chunks were omitted so nothing goes missing silently. */
export function selectRelevantContent(
  text: string,
  query: string | null
): { content: string; truncated: boolean; note: string | null } {
  if (text.length <= MAX_INLINE_CHARS) {
    return { content: text, truncated: false, note: null };
  }

  const chunks = splitIntoChunks(text);
  if (!query) {
    // No query to rank by — return as many chunks as fit, in document order,
    // clearly labeled as partial.
    let content = "";
    let used = 0;
    for (const c of chunks) {
      if (content.length + c.text.length > MAX_INLINE_CHARS) break;
      content += `\n\n--- ${c.location} ---\n${c.text}`;
      used++;
    }
    return {
      content: content.trim(),
      truncated: used < chunks.length,
      note:
        used < chunks.length
          ? `This document is large (${chunks.length} sections) — showing the first ${used}. Ask about a specific page, property, or section for more targeted content.`
          : null,
    };
  }

  const queryTerms = new Set(tokenize(query));
  const scored = chunks
    .map((c) => {
      const terms = tokenize(c.text);
      const score = terms.reduce((sum, t) => sum + (queryTerms.has(t) ? 1 : 0), 0);
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, MAX_CHUNKS_RETURNED).filter((s) => s.score > 0);
  const picked = top.length > 0 ? top : scored.slice(0, MAX_CHUNKS_RETURNED);

  const content = picked
    .sort((a, b) => chunks.indexOf(a.c) - chunks.indexOf(b.c))
    .map((s) => `--- ${s.c.location} ---\n${s.c.text}`)
    .join("\n\n");

  return {
    content,
    truncated: true,
    note: `This document is large (${chunks.length} sections) — showing the ${picked.length} section(s) most relevant to "${query}". Ask a more specific question to see other parts.`,
  };
}
