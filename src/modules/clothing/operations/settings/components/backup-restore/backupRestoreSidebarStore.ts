import { create } from 'zustand';

export type BackupRestoreTableSummary = {
  name: string;
  count: number;
};

interface BackupRestoreSidebarState {
  tables: BackupRestoreTableSummary[];
  selectedTable: string | null;
  setTables: (tables: BackupRestoreTableSummary[]) => void;
  setSelectedTable: (table: string | null) => void;
  clear: () => void;
}

export const useBackupRestoreSidebarStore = create<BackupRestoreSidebarState>()(
  (set) => ({
    tables: [],
    selectedTable: null,
    setTables: (tables) => set({ tables }),
    setSelectedTable: (selectedTable) => set({ selectedTable }),
    clear: () => set({ tables: [], selectedTable: null }),
  })
);
