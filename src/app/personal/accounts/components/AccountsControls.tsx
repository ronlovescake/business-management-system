import React, { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconChartPie,
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

interface AccountsControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterType: string | null;
  onTypeFilterChange: (type: string | null) => void;
  filterStatus: string | null;
  onStatusFilterChange: (status: string | null) => void;
  filterInstitution: string | null;
  onInstitutionFilterChange: (institution: string | null) => void;
  types: string[];
  institutions: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddAccount: () => void;
  isImporting: boolean;
}

export const AccountsControls = memo(function AccountsControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterType,
  onTypeFilterChange,
  filterStatus,
  onStatusFilterChange,
  filterInstitution,
  onInstitutionFilterChange,
  types,
  institutions,
  onImportCSV,
  onExportCSV,
  onAddAccount,
  isImporting,
}: AccountsControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="accounts-controls-search"]',
    activeTab === 'list'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Account List',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search accounts..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="accounts-controls-search"
          />
          <Select
            placeholder="Filter by type"
            data={['All', ...types]}
            value={filterType}
            onChange={(value) =>
              onTypeFilterChange(value === 'All' ? null : value)
            }
            clearable
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by status"
            data={['All', 'active', 'inactive']}
            value={filterStatus}
            onChange={(value) =>
              onStatusFilterChange(value === 'All' ? null : value)
            }
            clearable
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by institution"
            data={['All', ...institutions]}
            value={filterInstitution}
            onChange={(value) =>
              onInstitutionFilterChange(value === 'All' ? null : value)
            }
            clearable
            style={{ width: 200 }}
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
            onClick={onAddAccount}
          >
            Add Account
          </Button>
        </Group>
      ),
    },
    {
      value: 'analytics',
      label: 'Analytics',
      leftSection: <IconChartPie size={16} />,
      panel: <div />,
    },
  ];

  return (
    <ControlPanelCard
      title="Account Records"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
