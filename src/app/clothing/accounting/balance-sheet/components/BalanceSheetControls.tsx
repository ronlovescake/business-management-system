import React, { memo } from 'react';
import { Group, TextInput, Select, Button } from '@mantine/core';
import { IconList, IconSearch, IconDownload } from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface BalanceSheetControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  asOf: string;
  onAsOfChange: (asOf: string) => void;
  onExportCSV: () => void;
}

export const BalanceSheetControls = memo(function BalanceSheetControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  asOf,
  onAsOfChange,
  onExportCSV,
}: BalanceSheetControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="balance-sheet-controls-search"]',
    activeTab === 'list'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Balance Sheet',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search accounts..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="balance-sheet-controls-search"
          />
          <Select
            placeholder="As of date"
            data={[asOf, 'December 31, 2025', 'November 30, 2025']}
            value={asOf}
            onChange={(value) => value && onAsOfChange(value)}
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
      title="Balance Sheet"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
