import React, { memo } from 'react';
import { Stack, Text } from '@mantine/core';
import { IconChartBar, IconList, IconTable } from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
import { AccountingSearchSelectExportTabPanel } from '../../components/AccountingSearchSelectExportTabPanel';
import {
  PROFIT_LOSS_PERIOD_OPTIONS,
  type ProfitLossPeriodOption,
} from '../hooks/useProfitLoss';

interface ProfitLossControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  period: ProfitLossPeriodOption;
  onPeriodChange: (period: ProfitLossPeriodOption) => void;
  onExportCSV: () => void;
  onExportDetailsCSV: () => void;
  onDownloadTemplate: () => void;
}

export const ProfitLossControls = memo(function ProfitLossControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  period,
  onPeriodChange,
  onExportCSV,
  onExportDetailsCSV,
  onDownloadTemplate,
}: ProfitLossControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="profit-loss-controls-search"]',
    activeTab === 'list'
  );
  useCtrlFFocus(
    '[data-ctrlf-target="profit-loss-details-controls-search"]',
    activeTab === 'details'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Profit & Loss',
      leftSection: <IconList size={16} />,
      panel: (
        <AccountingSearchSelectExportTabPanel
          searchPlaceholder="Search categories..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="profit-loss-controls-search"
          selectPlaceholder="Select period"
          selectOptions={PROFIT_LOSS_PERIOD_OPTIONS}
          selectValue={period}
          onSelectChange={(value) => {
            if (
              PROFIT_LOSS_PERIOD_OPTIONS.includes(
                value as ProfitLossPeriodOption
              )
            ) {
              onPeriodChange(value as ProfitLossPeriodOption);
            }
          }}
          selectWidth={220}
          onExport={onExportCSV}
          onDownloadTemplate={onDownloadTemplate}
        />
      ),
    },
    {
      value: 'details',
      label: 'Details',
      leftSection: <IconTable size={16} />,
      panel: (
        <AccountingSearchSelectExportTabPanel
          searchPlaceholder="Search details..."
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchCtrlFTarget="profit-loss-details-controls-search"
          selectPlaceholder="Select period"
          selectOptions={PROFIT_LOSS_PERIOD_OPTIONS}
          selectValue={period}
          onSelectChange={(value) => {
            if (
              PROFIT_LOSS_PERIOD_OPTIONS.includes(
                value as ProfitLossPeriodOption
              )
            ) {
              onPeriodChange(value as ProfitLossPeriodOption);
            }
          }}
          selectWidth={220}
          exportLabel="Export Details"
          onExport={onExportDetailsCSV}
        />
      ),
    },
    {
      value: 'breakdowns',
      label: 'P&L Breakdowns',
      leftSection: <IconChartBar size={16} />,
      panel: (
        <Stack gap={4}>
          <Text fw={600}>Breakdowns</Text>
          <Text size="sm" c="dimmed">
            Controls will appear here once breakdown views are available.
          </Text>
        </Stack>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Profit & Loss"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
