import React, { memo } from 'react';
import { IconList } from '@tabler/icons-react';
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
}

export const ProfitLossControls = memo(function ProfitLossControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  period,
  onPeriodChange,
  onExportCSV,
}: ProfitLossControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="profit-loss-controls-search"]',
    activeTab === 'list'
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
        />
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
