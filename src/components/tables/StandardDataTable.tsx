import type { ReactNode } from 'react';
import { useId, useState } from 'react';
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
    height: '86vh',
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

interface StandardDataTableProps {
  /**
   * Table headers - array of column names
   */
  headers: string[];

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
  height = '86vh',
  emptyState,
  colSpan,
}: StandardDataTableProps) {
  return (
    <Card withBorder padding={0} style={{ overflow: 'hidden', height: height }}>
      <Box style={{ height: '100%', overflowY: 'auto' }}>
        <Table highlightOnHover withTableBorder>
          <Table.Thead
            style={{
              backgroundColor: '#f1f3f5',
              position: 'sticky',
              top: -1,
              zIndex: 1000,
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Table.Tr style={{ backgroundColor: '#f1f3f5' }}>
              {headers.map((header) => (
                <Table.Th
                  key={header}
                  style={{
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                    borderBottom: '2px solid #dee2e6',
                    borderTop: '1px solid #f1f3f5',
                  }}
                >
                  {header}
                </Table.Th>
              ))}
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
}

export function StandardTableControls({
  searchPlaceholder = 'Search...',
  onSearch,
  onImport,
  onExport,
  onAddNew,
  isImporting = false,
  hideImport = false,
  hideExport = false,
  hideAddNew = false,
  hideSearch = false,
  acceptFileTypes = '.csv,text/csv',
  enableCtrlF = true,
}: StandardTableControlsProps) {
  const [searchValue, setSearchValue] = useState('');
  const ctrlFId = useId();
  const searchTarget = `standard-table-search-${ctrlFId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const ctrlFFocusEnabled = enableCtrlF && !hideSearch;

  useCtrlFFocus(`[data-ctrlf-target="${searchTarget}"]`, ctrlFFocusEnabled);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch?.(value);
  };

  return (
    <Group justify="space-between" wrap="wrap">
      {!hideSearch && (
        <TextInput
          placeholder={
            ctrlFFocusEnabled
              ? `${searchPlaceholder} (Ctrl+F)`
              : searchPlaceholder
          }
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={handleSearchChange}
          style={{ flex: 1 }}
          data-ctrlf-target={searchTarget}
        />
      )}
      <Group gap="sm">
        {!hideImport && (
          <FileButton
            onChange={(file) => onImport?.(file)}
            accept={acceptFileTypes}
          >
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
          <Button leftSection={<IconDownload size={16} />} onClick={onExport}>
            Export
          </Button>
        )}
        {!hideAddNew && (
          <Button leftSection={<IconPlus size={16} />} onClick={onAddNew}>
            Add New
          </Button>
        )}
      </Group>
    </Group>
  );
}

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
