import React, { memo } from 'react';
import { IconList } from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
import { AccountingEntriesListTabPanel } from '../../components/AccountingEntriesListTabPanel';
import {
  JOURNAL_PERIOD_OPTIONS,
  type JournalPeriodOption,
} from '../hooks/useJournal';

interface JournalControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterAccount: string | null;
  onAccountFilterChange: (account: string | null) => void;
  period: JournalPeriodOption;
  onPeriodChange: (period: JournalPeriodOption) => void;
  accounts: string[];
  onImportCSV: (file: File | null) => void;
  onDownloadTemplate: () => void;
  onExportCSV: () => void;
  onAddEntry: () => void;
  isImporting?: boolean;
}

export const JournalControls = memo(function JournalControls({
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
  onDownloadTemplate,
  onExportCSV,
  onAddEntry,
  isImporting = false,
}: JournalControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="journal-controls-search"]',
    activeTab === 'list'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Journal Entries',
      leftSection: <IconList size={16} />,
      panel: (
        <AccountingEntriesListTabPanel
          searchPlaceholder="Search journal..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="journal-controls-search"
          accounts={accounts}
          filterAccount={filterAccount}
          onAccountFilterChange={onAccountFilterChange}
          periodOptions={JOURNAL_PERIOD_OPTIONS}
          period={period}
          onPeriodChange={(nextPeriod) =>
            onPeriodChange(nextPeriod as JournalPeriodOption)
          }
          onImportCSV={onImportCSV}
          onDownloadTemplate={onDownloadTemplate}
          onExportCSV={onExportCSV}
          onAddEntry={onAddEntry}
          isImporting={isImporting}
        />
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Journal"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
