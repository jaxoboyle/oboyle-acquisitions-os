import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}

interface ToastStore {
  toasts: ToastMessage[];
  push: (kind: ToastKind, text: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toastSuccess(text: string) {
  useToastStore.getState().push("success", text);
}
export function toastError(text: string) {
  useToastStore.getState().push("error", text);
}
export function toastInfo(text: string) {
  useToastStore.getState().push("info", text);
}

/** Extracts a readable message from a Tauri invoke() rejection. */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
