import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskInput } from "@/lib/types";
import { errorMessage, toastError, toastSuccess } from "@/lib/toast";

export function useTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: api.tasks.list });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => api.tasks.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toastSuccess("Task added");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) => api.tasks.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toastSuccess("Task updated");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useSetTaskCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.tasks.setCompleted(id, completed),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toastSuccess("Task deleted");
    },
    onError: (e) => toastError(errorMessage(e)),
  });
}
