import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BusinessState {
  selectedBusiness: string | null;
  selectedWorkspace: string | null;
  setSelectedBusiness: (business: string) => void;
  setSelectedWorkspace: (workspace: string) => void;
  initializeFromPath: (pathname: string) => void;
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      selectedBusiness: null,
      selectedWorkspace: null,
      setSelectedBusiness: (business: string) =>
        set({ selectedBusiness: business }),
      setSelectedWorkspace: (workspace: string) =>
        set({ selectedWorkspace: workspace }),
      initializeFromPath: (pathname: string) => {
        const pathParts = pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          const [business, workspace] = pathParts;

          // For personal finance, normalize workspace to a single value
          if (business === 'personal') {
            set({
              selectedBusiness: 'personal',
              selectedWorkspace: 'personal',
            });
            return;
          }

          set({
            selectedBusiness: business,
            selectedWorkspace: workspace,
          });
        }
      },
    }),
    {
      name: 'business-store',
    }
  )
);
