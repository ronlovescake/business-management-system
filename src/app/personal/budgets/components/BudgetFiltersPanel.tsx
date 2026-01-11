'use client';

import { Button, Group, Select, TextInput } from '@mantine/core';
import {
  IconDownload,
  IconPlus,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import type { BudgetStatus } from '../../hooks/usePersonalBudgetsView';

interface BudgetFiltersPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  filterCategory: string | null;
  onCategoryFilterChange: (value: string | null) => void;
  filterPeriod: 'monthly' | 'annual' | 'all' | null;
  onPeriodFilterChange: (value: 'monthly' | 'annual' | 'all' | null) => void;
  filterStatus: BudgetStatus | 'all' | null;
  onStatusFilterChange: (value: BudgetStatus | 'all' | null) => void;
  onImportCSV: () => void;
  onExportCSV: () => void;
  onAddBudget: () => void;
}

export function BudgetFiltersPanel({
  searchQuery,
  onSearchChange,
  categories,
  filterCategory,
  onCategoryFilterChange,
  filterPeriod,
  onPeriodFilterChange,
  filterStatus,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddBudget,
}: BudgetFiltersPanelProps) {
  return (
    <Group wrap="wrap" gap="sm">
      <TextInput
        placeholder="Search budgets..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        style={{ flex: 1, minWidth: 240 }}
      />
      <Select
        placeholder="Filter by category"
        data={['All', ...categories]}
        value={filterCategory ?? 'All'}
        onChange={(value) =>
          onCategoryFilterChange(value === 'All' ? null : value)
        }
        clearable
        style={{ width: 200 }}
      />
      <Select
        placeholder="Filter by period"
        data={['All', 'monthly', 'annual']}
        value={filterPeriod ?? 'All'}
        onChange={(value) =>
          onPeriodFilterChange(
            value === 'All' ? null : (value as 'monthly' | 'annual' | 'all')
          )
        }
        clearable
        style={{ width: 200 }}
      />
      <Select
        placeholder="Filter by status"
        data={['All', 'over', 'under', 'on-track']}
        value={filterStatus ?? 'All'}
        onChange={(value) =>
          onStatusFilterChange(
            value === 'All' ? null : (value as BudgetStatus | 'all' | null)
          )
        }
        clearable
        style={{ width: 200 }}
      />
      <Button
        leftSection={<IconUpload size={16} />}
        size="sm"
        radius="sm"
        styles={actionButtonStyles}
        onClick={onImportCSV}
      >
        Import CSV
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
        onClick={onAddBudget}
      >
        Add Budget
      </Button>
    </Group>
  );
}
