import React, { memo } from 'react';
import {
  IconList,
  IconWallet,
  IconBox,
  IconTruckDelivery,
} from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
import { AccountingSearchSelectExportTabPanel } from '../../components/AccountingSearchSelectExportTabPanel';

interface BalanceSheetControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  asOf: string;
  onAsOfChange: (asOf: string) => void;
  onExportCSV: () => void;
  onDownloadTemplate: () => void;
}

export const BalanceSheetControls = memo(function BalanceSheetControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  asOf,
  onAsOfChange,
  onExportCSV,
  onDownloadTemplate,
}: BalanceSheetControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="balance-sheet-controls-search"]',
    activeTab === 'list' ||
      activeTab === 'cash' ||
      activeTab === 'stock' ||
      activeTab === 'transit'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Balance Sheet',
      leftSection: <IconList size={16} />,
      panel: (
        <AccountingSearchSelectExportTabPanel
          searchPlaceholder="Search accounts..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="balance-sheet-controls-search"
          selectPlaceholder="As of date"
          selectOptions={[asOf, 'December 31, 2025', 'November 30, 2025']}
          selectValue={asOf}
          onSelectChange={onAsOfChange}
          selectWidth={220}
          onExport={onExportCSV}
          onDownloadTemplate={onDownloadTemplate}
        />
      ),
    },
    {
      value: 'cash',
      label: 'Cash',
      leftSection: <IconWallet size={16} />,
      panel: (
        <AccountingSearchSelectExportTabPanel
          searchPlaceholder="Search cash details..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="balance-sheet-controls-search"
          selectPlaceholder="As of date"
          selectOptions={[asOf, 'December 31, 2025', 'November 30, 2025']}
          selectValue={asOf}
          onSelectChange={onAsOfChange}
          selectWidth={220}
          onExport={onExportCSV}
          onDownloadTemplate={onDownloadTemplate}
        />
      ),
    },
    {
      value: 'stock',
      label: 'Stock on Hand',
      leftSection: <IconBox size={16} />,
      panel: (
        <AccountingSearchSelectExportTabPanel
          searchPlaceholder="Search stock details..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="balance-sheet-controls-search"
          selectPlaceholder="As of date"
          selectOptions={[asOf, 'December 31, 2025', 'November 30, 2025']}
          selectValue={asOf}
          onSelectChange={onAsOfChange}
          selectWidth={220}
          onExport={onExportCSV}
          onDownloadTemplate={onDownloadTemplate}
        />
      ),
    },
    {
      value: 'transit',
      label: 'Inventory in Transit',
      leftSection: <IconTruckDelivery size={16} />,
      panel: (
        <AccountingSearchSelectExportTabPanel
          searchPlaceholder="Search transit details..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="balance-sheet-controls-search"
          selectPlaceholder="As of date"
          selectOptions={[asOf, 'December 31, 2025', 'November 30, 2025']}
          selectValue={asOf}
          onSelectChange={onAsOfChange}
          selectWidth={220}
          onExport={onExportCSV}
          onDownloadTemplate={onDownloadTemplate}
        />
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Balance Sheet"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
