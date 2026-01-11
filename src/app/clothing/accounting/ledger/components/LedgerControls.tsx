import React, { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
  IconBuildingBank,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
import {
  LEDGER_PERIOD_OPTIONS,
  type LedgerPeriodOption,
} from '../hooks/useLedger';

interface LedgerControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterAccount: string | null;
  onAccountFilterChange: (account: string | null) => void;
  period: LedgerPeriodOption;
  onPeriodChange: (period: LedgerPeriodOption) => void;
  accounts: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddEntry: () => void;
  onAddOpeningEntry?: () => void;
  isImporting?: boolean;
}

export const LedgerControls = memo(function LedgerControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterAccount,
  onAccountFilterChange,
  period,
  onPeriodChange,
  accounts,
  onImportCSV,
  onExportCSV,
  onAddEntry,
  onAddOpeningEntry,
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
          <Select
            placeholder="Select period"
            data={LEDGER_PERIOD_OPTIONS}
            value={period}
            onChange={(value) => {
              if (!value) {
                return;
              }
              if (LEDGER_PERIOD_OPTIONS.includes(value as LedgerPeriodOption)) {
                onPeriodChange(value as LedgerPeriodOption);
              }
            }}
            style={{ width: 180 }}
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
    {
      value: 'opening-balance',
      label: 'Opening Balance',
      leftSection: <IconBuildingBank size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Opening balances are managed below"
            value=""
            readOnly
            style={{ flex: 1, minWidth: 220 }}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            radius="sm"
            color="green"
            onClick={onAddOpeningEntry ?? onAddEntry}
          >
            Add Opening Entry
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
