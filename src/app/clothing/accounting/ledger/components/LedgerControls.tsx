import React, { memo } from 'react';
import { Group, TextInput, Button } from '@mantine/core';
import { IconList, IconPlus, IconBuildingBank } from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
import { AccountingEntriesListTabPanel } from '../../components/AccountingEntriesListTabPanel';
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
        <AccountingEntriesListTabPanel
          searchPlaceholder="Search ledger..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="ledger-controls-search"
          accounts={accounts}
          filterAccount={filterAccount}
          onAccountFilterChange={onAccountFilterChange}
          periodOptions={LEDGER_PERIOD_OPTIONS}
          period={period}
          onPeriodChange={(nextPeriod) =>
            onPeriodChange(nextPeriod as LedgerPeriodOption)
          }
          onImportCSV={onImportCSV}
          onExportCSV={onExportCSV}
          onAddEntry={onAddEntry}
          isImporting={isImporting}
        />
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
