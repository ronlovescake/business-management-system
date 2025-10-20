import React from 'react';
import {
  Stack,
  Text,
  Button,
  Group,
  FileInput,
  TextInput,
  Card,
  SimpleGrid,
  ThemeIcon,
  Title,
  Modal,
} from '@mantine/core';
import {
  IconUpload,
  IconSearch,
  IconCurrencyPeso,
  IconTrendingUp,
  IconAdjustments,
  IconPlus,
} from '@tabler/icons-react';
import { GridView } from '@/components/grid';
import type {
  GridColumn,
  Item,
  GridCell,
  GridSelection,
} from '@glideapps/glide-data-grid';

/**
 * ProductsLayout Component
 *
 * Abstraction layer for products page that separates:
 * - Business logic (calculations, data operations) → stays in page.tsx
 * - UI layout (stats cards, buttons, modals) → this component
 * - Grid implementation (GridView) → swappable
 */

export interface ProductStats {
  total: number;
  totalValue: number;
  avgValue: number;
  totalProfit: number;
}

export interface ProductsLayoutProps<T = Record<string, unknown>> {
  // Data
  data: T[];
  filteredData: T[];
  columns: GridColumn[];

  // Stats
  stats: ProductStats;

  // Search
  searchQuery: string;
  onSearch: (query: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;

  // Grid Interaction
  getCellContent: (cell: Item) => GridCell;
  onCellEdited?: (cell: Item, newValue: GridCell) => void;
  onCellClick?: (cell: Item) => void;
  gridSelection?: GridSelection;
  onGridSelectionChange?: (newSelection: GridSelection) => void;

  // CSV Import
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: () => void;

  // Paste Mode
  pasteMode?: boolean;
  onPasteModeToggle?: () => void;

  // Add Product Modal
  addProductOpen?: boolean;
  onAddProductOpenChange?: (open: boolean) => void;
  onAddProductClick?: () => void;
  addProductForm?: React.ReactNode; // The form content passed from parent

  // Grid Props
  width?: number;
  height?: number;
  customStyles?: string;
  enableClickableCursor?: boolean;
}

export function ProductsLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  stats,
  searchQuery,
  onSearch,
  searchInputRef,
  getCellContent,
  onCellEdited,
  onCellClick,
  gridSelection,
  onGridSelectionChange,
  csvFile,
  onFileChange,
  onCSVImport,
  pasteMode = false,
  onPasteModeToggle,
  addProductOpen = false,
  onAddProductOpenChange,
  onAddProductClick,
  addProductForm,
  width,
  height = 83,
  customStyles,
  enableClickableCursor = true,
}: ProductsLayoutProps<T>) {
  return (
    <Stack
      gap="md"
      style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
    >
      {/* Custom Styles */}
      {customStyles && (
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      )}

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card
          shadow="sm"
          padding="md"
          radius="md"
          style={{ background: 'var(--mantine-color-blue-6)', color: 'white' }}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                Total Products
              </Text>
              <Title order={3} c="white">
                {stats.total}
              </Title>
            </div>
            <ThemeIcon variant="white" color="blue" size="lg" radius="md">
              <IconCurrencyPeso size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card
          shadow="sm"
          padding="md"
          radius="md"
          style={{ background: 'var(--mantine-color-green-6)', color: 'white' }}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                Total Value
              </Text>
              <Title order={3} c="white">
                ₱{stats.totalValue.toLocaleString()}
              </Title>
            </div>
            <ThemeIcon variant="white" color="green" size="lg" radius="md">
              <IconTrendingUp size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card
          shadow="sm"
          padding="md"
          radius="md"
          style={{ background: '#fd7e14', color: 'white' }}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                Average Value
              </Text>
              <Title order={3} c="white">
                ₱{stats.avgValue.toLocaleString()}
              </Title>
            </div>
            <ThemeIcon variant="white" color="orange" size="lg" radius="md">
              <IconAdjustments size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card
          shadow="sm"
          padding="md"
          radius="md"
          style={{ background: '#9775fa', color: 'white' }}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                Total Profit
              </Text>
              <Title order={3} c="white">
                ₱{stats.totalProfit.toLocaleString()}
              </Title>
            </div>
            <ThemeIcon variant="white" color="purple" size="lg" radius="md">
              <IconTrendingUp size={18} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Search and Controls */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <TextInput
          ref={searchInputRef}
          placeholder="Search products by code, name, shipment code..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => onSearch(e.currentTarget?.value || '')}
          style={{ flex: 1, minWidth: 300 }}
          size="md"
          radius="md"
        />

        <Group gap="sm">
          {onPasteModeToggle && (
            <Button
              variant={pasteMode ? 'filled' : 'outline'}
              color={pasteMode ? 'yellow' : 'gray'}
              size="md"
              radius="md"
              onClick={onPasteModeToggle}
            >
              {pasteMode ? 'Disable Paste Mode' : 'Enable Paste Mode'}
            </Button>
          )}
          {onFileChange && (
            <FileInput
              placeholder="Select CSV file"
              accept=".csv"
              value={csvFile}
              onChange={onFileChange}
              leftSection={<IconUpload size={16} />}
              size="md"
              radius="md"
              style={{ minWidth: 200 }}
            />
          )}
          {onCSVImport && (
            <Button
              onClick={onCSVImport}
              disabled={!csvFile}
              leftSection={<IconUpload size={16} />}
              size="md"
              radius="md"
              color="blue"
            >
              Import CSV
            </Button>
          )}
          {onAddProductClick && (
            <Button
              leftSection={<IconPlus size={16} />}
              variant="filled"
              color="green"
              size="md"
              radius="md"
              onClick={onAddProductClick}
            >
              Add Product
            </Button>
          )}
        </Group>
      </Group>

      {/* Add Product Modal */}
      {addProductForm && onAddProductOpenChange && (
        <Modal
          opened={addProductOpen}
          onClose={() => onAddProductOpenChange(false)}
          closeOnClickOutside={false}
          closeOnEscape={false}
          withCloseButton={true}
          size="95%"
          radius="lg"
          shadow="xl"
          centered
          padding="xl"
          styles={{
            header: {
              backgroundColor: 'var(--mantine-color-green-0)',
              borderRadius: '12px 12px 0 0',
              padding: '24px 32px 16px 32px',
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            },
            title: {
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--mantine-color-green-8)',
            },
            body: {
              padding: '32px',
              backgroundColor: 'var(--mantine-color-gray-0)',
            },
            close: {
              color: 'var(--mantine-color-green-6)',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-green-1)',
              },
            },
          }}
        >
          {addProductForm}
        </Modal>
      )}

      {/* Grid View */}
      <div
        style={{ height: `${height}vh`, width: width ? `${width}px` : '100%' }}
      >
        <GridView
          data={filteredData}
          columns={columns}
          getCellContent={getCellContent}
          onCellEdited={onCellEdited}
          onCellClick={onCellClick}
          gridSelection={gridSelection}
          onGridSelectionChange={onGridSelectionChange}
          enableClickableCursor={enableClickableCursor}
        />
      </div>

      {/* Footer */}
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          Showing {filteredData.length} of {data.length} products
        </Text>
      </Group>
    </Stack>
  );
}
