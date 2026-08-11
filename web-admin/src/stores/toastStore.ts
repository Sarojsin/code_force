import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastItem[];
  push: (title: string, detail?: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>(set => ({
  toasts: [],
  push: (title, detail, tone = 'success') => {
    const id = nextId++;
    set(state => ({ toasts: [...state.toasts, { id, title, detail, tone }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4200);
  },
  dismiss: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));

export const toast = {
  success: (title: string, detail?: string) => useToastStore.getState().push(title, detail, 'success'),
  error: (title: string, detail?: string) => useToastStore.getState().push(title, detail, 'error'),
  info: (title: string, detail?: string) => useToastStore.getState().push(title, detail, 'info'),
};
