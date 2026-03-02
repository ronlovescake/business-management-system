import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useId, useState } from 'react';
import {
  Stack,
  Card,
  Box,
  Table,
  Text,
  Group,
  TextInput,
  Button,
  FileButton,
} from '@mantine/core';
import {
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

/**
 * Standard table styling constants
 * These values ensure consistent appearance across all data tables
 */
export const STANDARD_TABLE_STYLES = {
  card: {
    height: '84vh',
    padding: 0,
    overflow: 'hidden' as const,
  },
  box: {
    height: '100%',
    overflowY: 'auto' as const,
  },
  header: {
    padding: '16px 12px',
    color: '#495057',
    backgroundColor: '#f1f3f5',
    textAlign: 'center' as const,
  },
  headerBackground: '#f1f3f5',
} as const;

type HeaderItem = string | { key: string; content: ReactNode };

interface StandardDataTableProps {
  /**
   * Table headers - array of column names
   */
  headers: readonly HeaderItem[];

  /**
   * Table body content - render prop for flexibility
   */
  children: ReactNode;

  /**
   * Optional: Override default table height (default: 71vh)
   */
  height?: string;

  /**
   * Optional: Show empty state when no data
   */
  emptyState?: ReactNode;

  /**
   * Optional: Number of columns for empty state colspan
   */
  colSpan?: number;

  /**
   * Optional: Add vertical borders between columns
   */
  withColumnBorders?: boolean;

  /**
   * Optional: Remove row borders
   */
  withoutRowBorders?: boolean;

  /**
   * Optional: Show table border (default: true)
   */
  withTableBorder?: boolean;

  /**
   * Optional: Header styling variant
   * - standard: existing StandardDataTable header style
   * - attendance: matches PageTemplates/DataTable attendance header style
   */
  headerVariant?: 'standard' | 'attendance';
}

/**
 * StandardDataTable Component
 *
 * Provides a consistent table layout with:
 * - Fixed height (71vh) with scrolling
 * - Gray header background (#f1f3f5)
 * - Centered header text
 * - Consistent padding and spacing
 * - Hover effects
 * - Border styling
 *
 * Usage:
 * ```tsx
 * <StandardDataTable
 *   headers={['Date', 'Amount', 'Description', 'Action']}
 *   colSpan={4}
 *   emptyState="No data found"
 * >
 *   {data.map(item => (
 *     <Table.Tr key={item.id}>
 *       <Table.Td>{item.date}</Table.Td>
 *       <Table.Td>{item.amount}</Table.Td>
 *       <Table.Td>{item.description}</Table.Td>
 *       <Table.Td>{/* actions *\/}</Table.Td>
 *     </Table.Tr>
 *   ))}
 * </StandardDataTable>
 * ```
 */
export function StandardDataTable({
  headers,
  children,
  height = '84vh',
  emptyState,
  colSpan,
  withColumnBorders = false,
  withoutRowBorders = false,
  withTableBorder = true,
  headerVariant = 'standard',
}: StandardDataTableProps) {
  const attendanceHeader = headerVariant === 'attendance';

  return (
    <Card withBorder padding={0} style={{ overflow: 'hidden', height: height }}>
      <Box style={{ height: '100%', overflowY: 'auto' }}>
        <Table
          highlightOnHover
          withTableBorder={withTableBorder}
          withColumnBorders={withColumnBorders}
          withRowBorders={!withoutRowBorders}
        >
          <Table.Thead
            style={{
              backgroundColor: '#f1f3f5',
              position: 'sticky',
              top: attendanceHeader ? 0 : -1,
              zIndex: attendanceHeader ? 2 : 100,
              boxShadow: attendanceHeader
                ? '0 2px 4px rgba(0, 0, 0, 0.05)'
                : '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Table.Tr style={{ backgroundColor: '#f1f3f5' }}>
              {headers.map((header, index) => {
                const key = typeof header === 'string' ? header : header.key;
                const content =
                  typeof header === 'string' ? header : header.content;

                return (
                  <Table.Th
                    key={key || `header-${index}`}
                    style={{
                      padding: '16px 12px',
                      color: '#495057',
                      backgroundColor: '#f1f3f5',
                      textAlign: 'center',
                      borderBottom: attendanceHeader
                        ? undefined
                        : '2px solid #dee2e6',
                      borderTop: attendanceHeader
                        ? undefined
                        : '1px solid #f1f3f5',
                    }}
                  >
                    {content}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {emptyState && !children ? (
              <Table.Tr>
                <Table.Td
                  colSpan={colSpan || headers.length}
                  style={{ textAlign: 'center' }}
                >
                  {typeof emptyState === 'string' ? (
                    <Text c="dimmed" py="xl">
                      {emptyState}
                    </Text>
                  ) : (
                    emptyState
                  )}
                </Table.Td>
              </Table.Tr>
            ) : (
              children
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </Card>
  );
}

/**
 * StandardTableControls Component
 *
 * Provides standard search and action controls for data tables:
 * - Auto-expanding search bar
 * - Import button (CSV)
 * - Export button (CSV)
 * - Add New button
 *
 * Usage:
 * ```tsx
 * <StandardTableControls
 *   searchPlaceholder="Search items..."
 *   onSearch={(query) => setSearchQuery(query)}
 *   onImport={(file) => handleImport(file)}
 *   onExport={() => handleExport()}
 *   onAddNew={() => handleAddNew()}
 * />
 * ```
 */
interface StandardTableControlsProps {
  /**
   * Placeholder text for search input
   */
  searchPlaceholder?: string;

  /**
   * Search query change handler
   */
  onSearch?: (query: string) => void;

  /**
   * Import CSV file handler
   */
  onImport?: (file: File | null) => void;

  /**
   * Export CSV handler
   */
  onExport?: () => void;

  /**
   * Add new item handler
   */
  onAddNew?: () => void;

  /**
   * Optional: Custom label for the Add New button
   */
  addNewLabel?: string;

  /**
   * Optional: Show loading state on import button
   */
  isImporting?: boolean;

  /**
   * Optional: Hide specific buttons
   */
  hideImport?: boolean;
  hideExport?: boolean;
  hideAddNew?: boolean;
  hideSearch?: boolean;

  /**
   * Optional: File types to accept for import
   * @default ".csv,text/csv"
   */
  acceptFileTypes?: string;

  /**
   * Optional: Enable Ctrl+F focus behavior for the search input
   */
  enableCtrlF?: boolean;

  /**
   * Optional: Make search input expand to full width
   */
  expandSearch?: boolean;
  searchAddon?: ReactNode;

  /**
   * Optional: Controlled search input value
   */
  searchValue?: string;

  /**
   * Optional: Gap value for control groups
   * @default "sm"
   */
  groupGap?: string | number;
}

export const StandardTableControls = memo(function StandardTableControls({
  searchPlaceholder = 'Search...',
  onSearch,
  onImport,
  onExport,
  onAddNew,
  addNewLabel = 'Add New',
  isImporting = false,
  hideImport = false,
  hideExport = false,
  hideAddNew = false,
  hideSearch = false,
  acceptFileTypes = '.csv,text/csv',
  enableCtrlF = true,
  expandSearch = false,
  searchAddon,
  searchValue,
  groupGap = 'sm',
}: StandardTableControlsProps) {
  const [internalSearchValue, setInternalSearchValue] = useState(
    searchValue ?? ''
  );
  const ctrlFId = useId();
  const searchTarget = `standard-table-search-${ctrlFId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const ctrlFFocusEnabled = enableCtrlF && !hideSearch;

  useCtrlFFocus(`[data-ctrlf-target="${searchTarget}"]`, ctrlFFocusEnabled);

  useEffect(() => {
    if (searchValue === undefined) {
      return;
    }
    setInternalSearchValue(searchValue);
  }, [searchValue]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (searchValue === undefined) {
        setInternalSearchValue(value);
      }
      onSearch?.(value);
    },
    [onSearch, searchValue]
  );

  const handleImportChange = useCallback(
    (file: File | null) => {
      onImport?.(file);
    },
    [onImport]
  );

  const handleExportClick = useCallback(() => {
    onExport?.();
  }, [onExport]);

  const handleAddNewClick = useCallback(() => {
    onAddNew?.();
  }, [onAddNew]);

  return (
    <Group
      justify={expandSearch ? 'flex-start' : 'space-between'}
      wrap="wrap"
      gap={groupGap}
      style={expandSearch ? { gap: '0.5rem', width: '100%' } : undefined}
    >
      {(!hideSearch || searchAddon) && (
        <Group
          gap={groupGap}
          align="flex-end"
          style={expandSearch ? { width: '100%' } : { flex: 1 }}
        >
          {!hideSearch && (
            <TextInput
              placeholder={
                ctrlFFocusEnabled
                  ? `${searchPlaceholder} (Ctrl+F)`
                  : searchPlaceholder
              }
              leftSection={<IconSearch size={16} />}
              value={searchValue ?? internalSearchValue}
              onChange={handleSearchChange}
              style={{ flex: 1 }}
              data-ctrlf-target={searchTarget}
            />
          )}
          {searchAddon}
        </Group>
      )}
      <Group gap={groupGap}>
        {!hideImport && (
          <FileButton onChange={handleImportChange} accept={acceptFileTypes}>
            {(props) => (
              <Button
                {...props}
                leftSection={<IconUpload size={16} />}
                loading={isImporting}
              >
                Import
              </Button>
            )}
          </FileButton>
        )}
        {!hideExport && (
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={handleExportClick}
          >
            Export
          </Button>
        )}
        {!hideAddNew && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAddNewClick}
          >
            {addNewLabel}
          </Button>
        )}
      </Group>
    </Group>
  );
});

StandardTableControls.displayName = 'StandardTableControls';

/**
 * StandardTableContainer Component
 *
 * Wraps StandardDataTable with optional header/footer sections
 * Provides consistent spacing for table-related UI elements
 */
interface StandardTableContainerProps {
  /**
   * Main table content
   */
  children: ReactNode;

  /**
   * Optional: Summary/footer section below table
   */
  summary?: ReactNode;
}

export function StandardTableContainer({
  children,
  summary,
}: StandardTableContainerProps) {
  return (
    <Stack gap="md">
      {children}
      {summary && (
        <Card withBorder padding="md">
          {summary}
        </Card>
      )}
    </Stack>
  );
}
