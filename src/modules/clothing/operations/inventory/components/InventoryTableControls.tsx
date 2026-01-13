import type { ReactNode } from 'react';
import { memo } from 'react';
import { StandardTableControls } from '@/components/tables/StandardDataTable';

interface InventoryTableControlsProps {
  onSearch: (value: string) => void;
  onImport: (file: File | null) => void;
  onExport: () => void;
  onAddNew: () => void;
  isImporting: boolean;
  showActions?: boolean;
  searchAddon?: ReactNode;
}

export const InventoryTableControls = memo(
  ({
    onSearch,
    onImport,
    onExport,
    onAddNew,
    isImporting,
    showActions = true,
    searchAddon,
  }: InventoryTableControlsProps) => {
    return (
      <StandardTableControls
        searchPlaceholder="Search inventory..."
        onSearch={onSearch}
        onImport={onImport}
        onExport={onExport}
        onAddNew={onAddNew}
        isImporting={isImporting}
        hideImport={!showActions}
        hideExport={!showActions}
        hideAddNew={!showActions}
        searchAddon={searchAddon}
      />
    );
  }
);

InventoryTableControls.displayName = 'InventoryTableControls';
