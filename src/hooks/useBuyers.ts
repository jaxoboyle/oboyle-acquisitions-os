import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BuyerInput } from "@/lib/types";
import { errorMessage, toastError, toastSuccess } from "@/lib/toast";

export function useBuyers() {
  return useQuery({ queryKey: ["buyers"], queryFn: api.buyers.list });
}

export function useCreateBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BuyerInput) => api.buyers.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buyers"] });
      toastSuccess("Buyer added");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useUpdateBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BuyerInput }) => api.buyers.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buyers"] });
      toastSuccess("Buyer updated");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useDeleteBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.buyers.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buyers"] });
      toastSuccess("Buyer deleted");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}
