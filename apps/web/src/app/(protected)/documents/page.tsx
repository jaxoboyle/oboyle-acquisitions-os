import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatRelative } from "@/lib/utils";
import { FolderOpen, File } from "lucide-react";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) return null;

  const { data: documents } = await supabase
    .from("documents")
    .select("id, category, file_name, file_size_bytes, mime_type, uploaded_at, leads(seller_name)")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Documents"
        description="Contracts, disclosures, and files attached to leads, buyers, and deals."
      />

      <div className="card p-0 overflow-hidden">
        {!documents || documents.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents uploaded"
            description="Files attached to leads, buyers, or deals will be indexed here once they're uploaded."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Linked to</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const lead = Array.isArray(doc.leads) ? doc.leads[0] : doc.leads;
                  return (
                    <tr key={doc.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <File size={14} className="text-text-subtle shrink-0" />
                          <span className="font-medium text-text">{doc.file_name}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant="neutral">{doc.category}</Badge>
                      </td>
                      <td className="text-text-muted">{lead?.seller_name ?? "—"}</td>
                      <td className="text-text-muted">{formatFileSize(doc.file_size_bytes)}</td>
                      <td className="text-text-muted">{formatRelative(doc.uploaded_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
