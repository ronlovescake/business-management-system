import { memo } from 'react';
import { StandardTableControls } from '@/components/tables/StandardDataTable';

interface InventoryTableControlsProps {
  onSearch: (value: string) => void;
  onImport: (file: File | null) => void;
  onExport: () => void;
  onAddNew: () => void;
  isImporting: boolean;
  showActions?: boolean;
}

export const InventoryTableControls = memo(
  ({
    onSearch,
    onImport,
    onExport,
    onAddNew,
    isImporting,
    showActions = true,
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
      />
    );
  }
);

InventoryTableControls.displayName = 'InventoryTableControls';
