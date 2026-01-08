import React, { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface LedgerControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterAccount: string | null;
  onAccountFilterChange: (account: string | null) => void;
  accounts: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddEntry: () => void;
  isImporting?: boolean;
}

export const LedgerControls = memo(function LedgerControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterAccount,
  onAccountFilterChange,
  accounts,
  onImportCSV,
  onExportCSV,
  onAddEntry,
  isImporting = false,
}: LedgerControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="ledger-controls-search"]',
    activeTab === 'list'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Ledger Entries',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search ledger..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="ledger-controls-search"
          />
          <Select
            placeholder="Filter by account"
            data={['All', ...accounts]}
            value={filterAccount}
            onChange={(value) =>
              onAccountFilterChange(value === 'All' ? null : value)
            }
            clearable
            style={{ width: 220 }}
          />
          <FileButton onChange={onImportCSV} accept=".csv,text/csv">
            {(props) => (
              <Button
                {...props}
                leftSection={<IconUpload size={16} />}
                size="sm"
                radius="sm"
                styles={actionButtonStyles}
                loading={isImporting}
              >
                Import CSV
              </Button>
            )}
          </FileButton>
          <Button
            leftSection={<IconDownload size={16} />}
            size="sm"
            radius="sm"
            styles={actionButtonStyles}
            onClick={onExportCSV}
          >
            Export
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            radius="sm"
            color="green"
            onClick={onAddEntry}
          >
            Add Entry
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Ledger"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
