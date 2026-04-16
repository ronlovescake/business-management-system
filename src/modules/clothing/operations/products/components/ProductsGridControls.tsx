import { memo } from 'react';
import { Button, Group, TextInput } from '@mantine/core';
import { IconEdit, IconLock, IconPlus, IconSearch } from '@tabler/icons-react';

interface ProductsGridControlsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onAddProduct: () => void;
  selectedShipmentCode: string | null;
  selectedProductCode: string | null;
  onTransitBuildUp: () => void;
  onTransitReclass: () => void;
  transitReclassDisabledReason?: string;
}

export const ProductsGridControls = memo(function ProductsGridControls({
  searchQuery,
  onSearchChange,
  isEditMode,
  onToggleEditMode,
  onAddProduct,
  selectedShipmentCode,
  selectedProductCode,
  onTransitBuildUp,
  onTransitReclass,
  transitReclassDisabledReason,
}: ProductsGridControlsProps) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
      <TextInput
        placeholder="Search products by code, name, shipment code..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(event) => onSearchChange(event.currentTarget?.value || '')}
        style={{ flex: 1, minWidth: 300 }}
        size="md"
        radius="md"
        data-ctrlf-target="products-search-input"
      />

      <Group gap="sm">
        <Button
          variant="filled"
          color="dark"
          size="sm"
          radius="sm"
          disabled={!selectedShipmentCode}
          onClick={onTransitBuildUp}
          title={
            selectedShipmentCode
              ? `Post transit build-up for ${selectedShipmentCode}${selectedProductCode ? ` (${selectedProductCode})` : ''}`
              : 'Select a product row with a Shipment Code first'
          }
        >
          Transit Build-Up
        </Button>
        <Button
          variant="filled"
          color="grape"
          size="sm"
          radius="sm"
          disabled={Boolean(transitReclassDisabledReason)}
          onClick={onTransitReclass}
          title={
            transitReclassDisabledReason
              ? transitReclassDisabledReason
              : selectedShipmentCode
                ? `Reclass ${selectedShipmentCode}${selectedProductCode ? ` (${selectedProductCode})` : ''} from Inventory in Transit to Stock on Hand`
                : 'Select a delivered product row with a Shipment Code first'
          }
        >
          Reclass to Stock on Hand
        </Button>
        <Button
          leftSection={
            isEditMode ? <IconLock size={16} /> : <IconEdit size={16} />
          }
          variant="filled"
          color={isEditMode ? 'red' : 'blue'}
          size="sm"
          radius="sm"
          onClick={onToggleEditMode}
        >
          {isEditMode ? 'Disable Edit Mode' : 'Enable Edit Mode'}
        </Button>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="filled"
          color="green"
          size="sm"
          radius="sm"
          onClick={onAddProduct}
        >
          Add Product
        </Button>
      </Group>
    </Group>
  );
});
