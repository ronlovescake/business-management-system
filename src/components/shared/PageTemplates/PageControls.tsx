import type { ReactNode } from 'react';
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
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

export interface TabConfig {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface FilterConfig {
  placeholder: string;
  data: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  width?: number;
}

interface PageControlsProps {
  title: string;
  // Tab Configuration
  tabs?: TabConfig[];
  activeTab?: string | null;
  onTabChange?: (tab: string | null) => void;
  // Search
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Filters
  filters?: FilterConfig[];
  // Actions
  onImportCSV?: (file: File | null) => void;
  onExportCSV?: () => void;
  onAdd?: () => void;
  addButtonLabel?: string;
  isImporting?: boolean;
  // Custom content for specific tabs
  children?: ReactNode;
}

/**
 * PageControls Component
 *
 * Reusable control panel with tabs, search, filters, and action buttons.
 * Provides consistent UI across all pages.
 *
 * @example
 * ```tsx
 * <PageControls
 *   title="Expense Records"
 *   tabs={[
 *     { value: 'list', label: 'Expense List', icon: <IconList size={16} /> },
 *     { value: 'analytics', label: 'Analytics', icon: <IconChartPie size={16} /> }
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   searchPlaceholder="Search expenses..."
 *   searchQuery={searchQuery}
 *   onSearchChange={setSearchQuery}
 *   filters={[
 *     { placeholder: 'Category', data: categories, value: category, onChange: setCategory },
 *     { placeholder: 'Status', data: statuses, value: status, onChange: setStatus }
 *   ]}
 *   onImportCSV={handleImport}
 *   onExportCSV={handleExport}
 *   onAdd={handleAdd}
 *   addButtonLabel="Add Expense"
 * />
 * ```
 */
export function PageControls({
  title,
  tabs,
  activeTab,
  onTabChange,
  searchPlaceholder = 'Search...',
  searchQuery,
  onSearchChange,
  filters = [],
  onImportCSV,
  onExportCSV,
  onAdd,
  addButtonLabel = 'Add',
  isImporting = false,
  children,
}: PageControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="page-controls-search"]',
    Boolean(onSearchChange)
  );

  const renderControls = () => (
    <Group wrap="wrap" gap="sm">
      {onSearchChange && (
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
          data-ctrlf-target="page-controls-search"
        />
      )}
      {filters.map((filter) => (
        <Select
          key={`filter-${filter.placeholder}-${filter.value ?? 'all'}`}
          placeholder={filter.placeholder}
          data={filter.data}
          value={filter.value}
          onChange={filter.onChange}
          clearable
          style={{ width: filter.width || 200 }}
        />
      ))}
      {onImportCSV && (
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
      )}
      {onExportCSV && (
        <Button
          leftSection={<IconDownload size={16} />}
          size="sm"
          radius="sm"
          styles={actionButtonStyles}
          onClick={onExportCSV}
        >
          Export
        </Button>
      )}
      {onAdd && (
        <Button
          leftSection={<IconPlus size={16} />}
          size="sm"
          radius="sm"
          color="green"
          onClick={onAdd}
        >
          {addButtonLabel}
        </Button>
      )}
    </Group>
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
          {title}
        </Title>

        {tabs && tabs.length > 0 ? (
          <Tabs value={activeTab} onChange={onTabChange}>
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  leftSection={tab.icon}
                >
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {tabs.map((tab) => (
              <Tabs.Panel key={tab.value} value={tab.value} pt="md">
                {renderControls()}
                {children}
              </Tabs.Panel>
            ))}
          </Tabs>
        ) : (
          renderControls()
        )}
      </Stack>
    </Card>
  );
}
