import { memo } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Group, TextInput } from '@mantine/core';
import { IconEdit, IconLock, IconPlus, IconSearch } from '@tabler/icons-react';

interface ProductsGridControlsProps {
  apiBasePath?: string;
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
  hasPendingChanges?: boolean;
}

export const ProductsGridControls = memo(function ProductsGridControls({
  apiBasePath,
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
  hasPendingChanges = false,
}: ProductsGridControlsProps) {
  const { data: session } = useSession();
  const canPostAccounting =
    Boolean(apiBasePath?.includes('/general-merchandise')) ||
    ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role ?? '');
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
        {canPostAccounting && (
          <>
            <Button
              variant="filled"
              color="dark"
              size="sm"
              radius="sm"
              disabled={hasPendingChanges || !selectedShipmentCode}
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
              disabled={
                hasPendingChanges || Boolean(transitReclassDisabledReason)
              }
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
          </>
        )}
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
          disabled={hasPendingChanges}
        >
          Add Product
        </Button>
      </Group>
    </Group>
  );
});
