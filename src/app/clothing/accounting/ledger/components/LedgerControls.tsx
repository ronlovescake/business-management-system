import React, { memo } from 'react';
import { Group, TextInput, Button, Select } from '@mantine/core';
import {
  IconList,
  IconPlus,
  IconBuildingBank,
  IconRepeat,
  IconHelpCircle,
} from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
import { AccountingEntriesListTabPanel } from '../../components/AccountingEntriesListTabPanel';
import {
  LEDGER_PERIOD_OPTIONS,
  type LedgerPeriodOption,
  OPENING_BALANCE_PERIOD_OPTIONS,
  type OpeningBalancePeriodOption,
} from '../hooks/useLedger';
import { LedgerHelpPanel } from './LedgerHelpPanel';

interface LedgerControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterAccount: string | null;
  onAccountFilterChange: (account: string | null) => void;
  period: LedgerPeriodOption;
  onPeriodChange: (period: LedgerPeriodOption) => void;
  openingBalancePeriod: OpeningBalancePeriodOption;
  onOpeningBalancePeriodChange: (period: OpeningBalancePeriodOption) => void;
  accounts: string[];
  onImportCSV: (file: File | null) => void;
  onDownloadTemplate: () => void;
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
  openingBalancePeriod,
  onOpeningBalancePeriodChange,
  accounts,
  onImportCSV,
  onDownloadTemplate,
  onExportCSV,
  onAddEntry,
  onAddOpeningEntry,
  isImporting = false,
}: LedgerControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="ledger-controls-search"]',
    activeTab === 'list' || activeTab === 'opening-balance'
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
          onDownloadTemplate={onDownloadTemplate}
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
            placeholder="Search opening balances..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="ledger-controls-search"
          />
          <Select
            placeholder="All Time"
            data={OPENING_BALANCE_PERIOD_OPTIONS}
            value={openingBalancePeriod}
            onChange={(value) => {
              if (!value) {
                return;
              }
              onOpeningBalancePeriodChange(value as OpeningBalancePeriodOption);
            }}
            style={{ minWidth: 180 }}
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
    {
      value: 'recurring-payments',
      label: 'Recurring Payments',
      leftSection: <IconRepeat size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Recurring payments are managed below"
            value=""
            readOnly
            style={{ flex: 1, minWidth: 220 }}
          />
        </Group>
      ),
    },
    {
      value: 'help',
      label: 'Help',
      leftSection: <IconHelpCircle size={16} />,
      panel: <LedgerHelpPanel />,
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
