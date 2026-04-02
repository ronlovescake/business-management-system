import { create } from 'zustand';

interface BreadcrumbState {
  /** Override label for the current (last) breadcrumb segment */
  pageLabel: string | null;
  setPageLabel: (label: string | null) => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>()((set) => ({
  pageLabel: null,
  setPageLabel: (label) => set({ pageLabel: label }),
}));
