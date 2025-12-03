import { Stack, Group, Text, Table } from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import type { ItemWeightData } from '../../types';

interface ItemWeightTabProps {
  itemWeightData: ItemWeightData[];
  filteredItemWeightData: ItemWeightData[];
  isItemWeightLoading: boolean;
  itemWeightError: string | null;
  onSearch: (query: string) => void;
  onOpenProducts: () => void;
  hasSearch: boolean;
}

export function ItemWeightTab({
  itemWeightData,
  filteredItemWeightData,
  isItemWeightLoading,
  itemWeightError,
  onSearch,
  onOpenProducts,
  hasSearch,
}: ItemWeightTabProps) {
  const emptyState = isItemWeightLoading
    ? 'Loading product weights...'
    : itemWeightError
      ? itemWeightError
      : filteredItemWeightData.length === 0 && hasSearch
        ? 'No product weights match your search.'
        : undefined;

  return (
    <Stack gap="md">
      <StandardTableControls
        searchPlaceholder="Search product weights..."
        onSearch={onSearch}
        hideImport
        hideExport
        onAddNew={onOpenProducts}
        addNewLabel="Open Products"
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredItemWeightData.length} of {itemWeightData.length}{' '}
              item weights
            </Text>
            <Text size="sm" c="dimmed">
              Manage weights in the Products module.
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'PRODUCT CODE',
            'BULK QUANTITY',
            'BULK WEIGHT',
            'WEIGHT PER PIECE',
          ]}
          emptyState={
            emptyState ||
            'No weight data yet. Update weights in the Products module.'
          }
          colSpan={4}
        >
          {filteredItemWeightData.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.productCode || '-'}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.bulkQuantity}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.bulkWeight}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.approxWeightPerPiece}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}
