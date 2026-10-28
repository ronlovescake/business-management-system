import React, { memo } from 'react';
import { Group, TextInput, Button, Select } from '@mantine/core';
import {
  IconList,
  IconPlus,
  IconBuildingBank,
  IconRepeat,
  IconHelpCircle,
  IconBook,
  IconSearch,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
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
import { LedgerBusinessGuidePanel } from './LedgerBusinessGuidePanel';
import type { ClothingManualEntryPresetId } from '../ledgerEntryGuidance';

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
  manualEntryGuidance?: boolean;
  onStartGuidedEntry?: (scenarioId: ClothingManualEntryPresetId) => void;
  onAddOpeningEntry?: () => void;
  isImporting?: boolean;
  showRecurringPaymentsTab?: boolean;
  recurringSearchQuery?: string;
  onRecurringSearchChange?: (query: string) => void;
  onGenerateRecurring?: () => void;
  isGeneratingRecurring?: boolean;
  onAddRecurring?: () => void;
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
  manualEntryGuidance = false,
  onStartGuidedEntry,
  onAddOpeningEntry,
  isImporting = false,
  showRecurringPaymentsTab = true,
  recurringSearchQuery = '',
  onRecurringSearchChange,
  onGenerateRecurring,
  isGeneratingRecurring = false,
  onAddRecurring,
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
            placeholder="Search recurring payments..."
            leftSection={<IconSearch size={16} />}
            value={recurringSearchQuery}
            onChange={(event) =>
              onRecurringSearchChange?.(event.currentTarget.value)
            }
            style={{ flex: 1, minWidth: 220 }}
          />
          <Button
            leftSection={<IconRepeat size={16} />}
            size="sm"
            radius="sm"
            styles={actionButtonStyles}
            onClick={() => onGenerateRecurring?.()}
            loading={isGeneratingRecurring}
          >
            Generate Due Drafts
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            radius="sm"
            color="green"
            onClick={() => onAddRecurring?.()}
          >
            Add Recurring Payment
          </Button>
        </Group>
      ),
    },
    {
      value: 'help',
      label: 'Help',
      leftSection: <IconHelpCircle size={16} />,
      panel: <div />,
    },
  ];

  if (manualEntryGuidance && onStartGuidedEntry) {
    tabs.push({
      value: 'business-guide',
      label: 'Business Guide',
      leftSection: <IconBook size={16} />,
      panel: <LedgerBusinessGuidePanel onStartEntry={onStartGuidedEntry} />,
    });
  }

  const visibleTabs = showRecurringPaymentsTab
    ? tabs
    : tabs.filter((tab) => tab.value !== 'recurring-payments');

  return (
    <ControlPanelCard
      title="Ledger"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={visibleTabs}
    />
  );
});
