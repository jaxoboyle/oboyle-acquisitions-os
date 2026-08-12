import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ActivityInput } from "@/lib/types";
import { errorMessage, toastError, toastSuccess } from "@/lib/toast";

export function useActivity(leadId: string | undefined) {
  return useQuery({
    queryKey: ["activity", leadId],
    queryFn: () => api.activity.list(leadId as string),
    enabled: !!leadId,
  });
}

export function useAddActivity(leadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActivityInput) => api.activity.add(leadId as string, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", leadId] });
      toastSuccess("Logged");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}
