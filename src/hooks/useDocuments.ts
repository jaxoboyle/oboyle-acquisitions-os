import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { errorMessage, toastError, toastSuccess } from "@/lib/toast";

export function useDocuments(leadId: string | undefined) {
  return useQuery({
    queryKey: ["documents", leadId],
    queryFn: () => api.documents.list(leadId as string),
    enabled: !!leadId,
  });
}

export function useAddDocument(leadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ category, sourcePath }: { category: string; sourcePath: string }) =>
      api.documents.add(leadId as string, category, sourcePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", leadId] });
      qc.invalidateQueries({ queryKey: ["activity", leadId] });
      toastSuccess("Document uploaded");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useDeleteDocument(leadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.documents.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", leadId] });
      toastSuccess("Document removed");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}
