import React, { memo } from 'react';
import {
  Card,
  Stack,
  Title,
  Tabs,
  Group,
  TextInput,
  Select,
  FileButton,
  Button,
} from '@mantine/core';
import {
  IconList,
  IconChartPie,
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface ExpenseControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterCategory: string | null;
  onCategoryFilterChange: (category: string | null) => void;
  filterStatus: string | null;
  onStatusFilterChange: (status: string | null) => void;
  categories: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddExpense: () => void;
  isImporting: boolean;
}

/**
 * ExpenseControls Component
 *
 * Header section with tabs, filters, and action buttons
 */
export const ExpenseControls = memo(function ExpenseControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterCategory,
  onCategoryFilterChange,
  filterStatus,
  onStatusFilterChange,
  categories,
  onImportCSV,
  onExportCSV,
  onAddExpense,
  isImporting,
}: ExpenseControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="expense-controls-search"]',
    activeTab === 'list'
  );

  return (
    <Card
      padding="lg"
      radius="xl"
      style={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
        transition: 'all 0.3s ease',
      }}
    >
      <Stack gap="md">
        <Title
          order={3}
          style={{
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          Expense Records
        </Title>

        <Tabs value={activeTab} onChange={onTabChange}>
          <Tabs.List>
            <Tabs.Tab value="list" leftSection={<IconList size={16} />}>
              Expense List
            </Tabs.Tab>
            <Tabs.Tab
              value="analytics"
              leftSection={<IconChartPie size={16} />}
            >
              Analytics by Category
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="list" pt="md">
            <Group wrap="wrap" gap="sm">
              <TextInput
                placeholder="Search expenses..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
                data-ctrlf-target="expense-controls-search"
              />
              <Select
                placeholder="Filter by category"
                data={['All', ...categories]}
                value={filterCategory}
                onChange={(value) =>
                  onCategoryFilterChange(value === 'All' ? null : value)
                }
                clearable
                style={{ width: 200 }}
              />
              <Select
                placeholder="Filter by status"
                data={['All', 'pending', 'approved', 'rejected']}
                value={filterStatus}
                onChange={(value) =>
                  onStatusFilterChange(value === 'All' ? null : value)
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
                onClick={onAddExpense}
              >
                Add Expense
              </Button>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="analytics" pt="md">
            <div />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Card>
  );
});
