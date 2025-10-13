import { Group, TextInput, Select, Button, FileButton } from '@mantine/core';
import {
  IconSearch,
  IconFileUpload,
  IconFileDownload,
  IconPlus,
} from '@tabler/icons-react';

interface RequestControlsProps {
  searchQuery: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string | null) => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddRequest: () => void;
}

export function RequestControls({
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddRequest,
}: RequestControlsProps) {
  return (
    <>
      {/* Search and Filters */}
      <Group mb="md" style={{ flexWrap: 'wrap', gap: '1rem' }}>
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

      {/* Action Buttons */}
      <Group mb="md" justify="space-between">
        <Group>
          <FileButton onChange={onImportCSV} accept=".csv">
            {(props) => (
              <Button
                {...props}
                leftSection={<IconFileUpload size={16} />}
                variant="light"
                color="blue"
              >
                Import CSV
              </Button>
            )}
          </FileButton>

          <Button
            leftSection={<IconFileDownload size={16} />}
            variant="light"
            color="blue"
            onClick={onExportCSV}
          >
            Export CSV
          </Button>
        </Group>

        <Button
          leftSection={<IconPlus size={16} />}
          onClick={onAddRequest}
          style={{ backgroundColor: '#85bd3a' }}
        >
          Add Request
        </Button>
      </Group>
    </>
  );
}
