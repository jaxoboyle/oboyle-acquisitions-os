import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DealInput } from "@/lib/types";
import { errorMessage, toastError, toastSuccess } from "@/lib/toast";

export function useDeals() {
  return useQuery({ queryKey: ["deals"], queryFn: api.deals.list });
}

export function useDealForLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ["deal", leadId],
    queryFn: () => api.deals.getByLead(leadId as string),
    enabled: !!leadId,
  });
}

export function useUpsertDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: DealInput }) =>
      api.deals.upsert(leadId, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["deal", vars.leadId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toastSuccess("Deal saved");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}
