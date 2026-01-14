import React, { memo, useMemo } from 'react';
import { Group, TextInput, Select, Button } from '@mantine/core';
import { IconSearch, IconDownload } from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';

export type AccountingSearchSelectExportTabPanelProps = {
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchCtrlFTarget: string;

  selectPlaceholder: string;
  selectOptions: readonly string[];
  selectValue: string;
  onSelectChange: (value: string) => void;
  selectWidth?: number;

  exportLabel?: string;
  onExport: () => void;
};

export const AccountingSearchSelectExportTabPanel = memo(
  function AccountingSearchSelectExportTabPanel({
    searchPlaceholder,
    searchQuery,
    onSearchChange,
    searchCtrlFTarget,
    selectPlaceholder,
    selectOptions,
    selectValue,
    onSelectChange,
    selectWidth = 220,
    exportLabel = 'Export',
    onExport,
  }: AccountingSearchSelectExportTabPanelProps) {
    const options = useMemo(() => {
      // Ensure we don't feed duplicates to Mantine Select.
      return Array.from(new Set([selectValue, ...selectOptions]));
    }, [selectOptions, selectValue]);

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
          placeholder={selectPlaceholder}
          data={options}
          value={selectValue}
          onChange={(value) => {
            if (!value) {
              return;
            }
            if (options.includes(value)) {
              onSelectChange(value);
            }
          }}
          style={{ width: selectWidth }}
        />
        <Button
          leftSection={<IconDownload size={16} />}
          size="sm"
          radius="sm"
          styles={actionButtonStyles}
          onClick={onExport}
        >
          {exportLabel}
        </Button>
      </Group>
    );
  }
);
