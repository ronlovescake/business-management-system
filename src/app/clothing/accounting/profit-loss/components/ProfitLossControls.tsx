import React, { memo, useMemo } from 'react';
import { Group, TextInput, Select, Button } from '@mantine/core';
import { IconList, IconSearch, IconDownload } from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
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

  const periodOptions = useMemo(() => {
    // Ensure we don't feed duplicates to Mantine Select.
    return Array.from(new Set([period, ...PROFIT_LOSS_PERIOD_OPTIONS]));
  }, [period]);

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Profit & Loss',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search categories..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="profit-loss-controls-search"
          />
          <Select
            placeholder="Select period"
            data={periodOptions}
            value={period}
            onChange={(value) => {
              if (!value) {
                return;
              }
              // Guard against unexpected values from the select.
              if (
                PROFIT_LOSS_PERIOD_OPTIONS.includes(
                  value as ProfitLossPeriodOption
                )
              ) {
                onPeriodChange(value as ProfitLossPeriodOption);
              }
            }}
            style={{ width: 220 }}
          />
          <Button
            leftSection={<IconDownload size={16} />}
            size="sm"
            radius="sm"
            styles={actionButtonStyles}
            onClick={onExportCSV}
          >
            Export
          </Button>
        </Group>
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
