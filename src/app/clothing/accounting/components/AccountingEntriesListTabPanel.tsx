import React, { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconSearch,
  IconUpload,
  IconDownload,
  IconFileTypeCsv,
  IconPlus,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';

export type AccountingEntriesListTabPanelProps = {
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchCtrlFTarget: string;

  accounts: string[];
  filterAccount: string | null;
  onAccountFilterChange: (account: string | null) => void;

  periodOptions: readonly string[];
  period: string;
  onPeriodChange: (period: string) => void;

  onImportCSV: (file: File | null) => void;
  onDownloadTemplate: () => void;
  onExportCSV: () => void;
  onAddEntry: () => void;
  addLabel?: string;
  isImporting?: boolean;
};

export const AccountingEntriesListTabPanel = memo(
  function AccountingEntriesListTabPanel({
    searchPlaceholder,
    searchQuery,
    onSearchChange,
    searchCtrlFTarget,
    accounts,
    filterAccount,
    onAccountFilterChange,
    periodOptions,
    period,
    onPeriodChange,
    onImportCSV,
    onDownloadTemplate,
    onExportCSV,
    onAddEntry,
    addLabel = 'Add Entry',
    isImporting = false,
  }: AccountingEntriesListTabPanelProps) {
    return (
      <Group wrap="wrap" gap="sm">
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
          data-ctrlf-target={searchCtrlFTarget}
        />
        <Select
          placeholder="Filter by account"
          data={['All', ...accounts]}
          value={filterAccount}
          onChange={(value) =>
            onAccountFilterChange(value === 'All' ? null : value)
          }
          clearable
          style={{ width: 220 }}
        />
        <Select
          placeholder="Select period"
          data={[...periodOptions]}
          value={period}
          onChange={(value) => {
            if (!value) {
              return;
            }
            if (periodOptions.includes(value)) {
              onPeriodChange(value);
            }
          }}
          style={{ width: 180 }}
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
          leftSection={<IconFileTypeCsv size={16} />}
          size="sm"
          radius="sm"
          styles={actionButtonStyles}
          variant="light"
          onClick={onDownloadTemplate}
        >
          Template
        </Button>
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
          onClick={onAddEntry}
        >
          {addLabel}
        </Button>
      </Group>
    );
  }
);
