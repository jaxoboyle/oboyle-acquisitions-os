import { useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { FileText, Trash2, Upload, FolderOpen } from "lucide-react";
import { useAddDocument, useDeleteDocument, useDocuments } from "@/hooks/useDocuments";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DOCUMENT_CATEGORIES } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { errorMessage, toastError } from "@/lib/toast";

export function DocumentsPanel({ leadId }: { leadId: string }) {
  const { data: documents, isLoading } = useDocuments(leadId);
  const addDocument = useAddDocument(leadId);
  const deleteDocument = useDeleteDocument(leadId);
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0].id);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function handleUpload() {
    try {
      const selected = await openFileDialog({ multiple: false });
      if (!selected || Array.isArray(selected)) return;
      addDocument.mutate({ category, sourcePath: selected });
    } catch (e) {
      toastError(errorMessage(e));
    }
  }

  async function handleOpen(id: string) {
    try {
      const path = await api.documents.absolutePath(id);
      await openPath(path);
    } catch (e) {
      toastError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-border p-3">
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-56">
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Button variant="primary" size="sm" onClick={handleUpload} disabled={addDocument.isPending}>
          <Upload size={14} /> Upload File
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : !documents || documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents yet"
          description="Purchase agreements, disclosures, proof of funds, and closing docs will be organized here."
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <FileText size={15} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-text">{doc.fileName}</div>
                  <div className="text-[11.5px] text-text-muted">
                    {DOCUMENT_CATEGORIES.find((c) => c.id === doc.category)?.label ?? doc.category} ·{" "}
                    {formatDateTime(doc.uploadedAt)}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleOpen(doc.id)}>
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger-soft"
                  onClick={() => setPendingDelete(doc.id)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this document?"
        description="The file will be permanently removed from this lead."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteDocument.mutate(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
