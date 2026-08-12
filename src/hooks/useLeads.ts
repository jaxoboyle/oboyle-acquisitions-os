import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LeadInput } from "@/lib/types";
import { errorMessage, toastError, toastSuccess } from "@/lib/toast";

export function useLeads() {
  return useQuery({ queryKey: ["leads"], queryFn: api.leads.list });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LeadInput) => api.leads.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toastSuccess("Lead added");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LeadInput }) => api.leads.update(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["activity", vars.id] });
      toastSuccess("Lead updated");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.leads.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      toastSuccess("Lead deleted");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useMoveLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage, stageOrder }: { id: string; stage: string; stageOrder: number }) =>
      api.leads.moveStage(id, stage, stageOrder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}
