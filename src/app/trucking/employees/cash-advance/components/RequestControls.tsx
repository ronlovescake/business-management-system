import { memo } from 'react';
import {
  Group,
  Stack,
  TextInput,
  Select,
  Button,
  FileButton,
} from '@mantine/core';
import {
  IconSearch,
  IconList,
  IconFileUpload,
  IconFileDownload,
  IconPlus,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';

interface RequestControlsProps {
  searchQuery: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string | null) => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddRequest: () => void;
}

export const RequestControls = memo(function RequestControls({
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddRequest,
}: RequestControlsProps) {
  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Cash Advance Requests',
      leftSection: <IconList size={16} />,
      panel: (
        <Stack gap="md">
          <Group style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <TextInput
              placeholder="Search by employee, purpose, or terms..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.currentTarget.value)}
              style={{ flex: '1 1 300px' }}
            />

            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={onStatusFilterChange}
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'paid', label: 'Paid' },
              ]}
              style={{ flex: '0 0 200px' }}
            />
          </Group>

          <Group justify="space-between">
            <Group>
              <FileButton onChange={onImportCSV} accept=".csv">
                {(props) => (
                  <Button
                    {...props}
                    leftSection={<IconFileUpload size={16} />}
                    size="sm"
                    radius="sm"
                    styles={actionButtonStyles}
                  >
                    Import CSV
                  </Button>
                )}
              </FileButton>

              <Button
                leftSection={<IconFileDownload size={16} />}
                size="sm"
                radius="sm"
                styles={actionButtonStyles}
                onClick={onExportCSV}
              >
                Export CSV
              </Button>
            </Group>

            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              radius="sm"
              onClick={onAddRequest}
              style={{ backgroundColor: '#85bd3a' }}
            >
              Add Request
            </Button>
          </Group>
        </Stack>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Cash Advance Requests"
      tabs={tabs}
      activeTab="list"
      onTabChange={() => {}}
    />
  );
});
