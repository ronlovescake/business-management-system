import { create } from 'zustand';

export type BackupRestoreTableSummary = {
  name: string;
  count: number;
};

interface BackupRestoreSidebarState {
  active: boolean;
  tables: BackupRestoreTableSummary[];
  selectedTable: string | null;
  setActive: (active: boolean) => void;
  setTables: (tables: BackupRestoreTableSummary[]) => void;
  setSelectedTable: (table: string | null) => void;
  clear: () => void;
}

export const useBackupRestoreSidebarStore = create<BackupRestoreSidebarState>()(
  (set) => ({
    active: false,
    tables: [],
    selectedTable: null,
    setActive: (active) => set({ active }),
    setTables: (tables) => set({ tables }),
    setSelectedTable: (selectedTable) => set({ selectedTable }),
    clear: () => set({ active: false, tables: [], selectedTable: null }),
  })
);
