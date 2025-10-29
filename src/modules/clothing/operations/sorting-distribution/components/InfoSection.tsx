/**
 * Info Section Component
 *
 * Displays product selection, statistics, and information fields.
 */

import React from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Select,
  Flex,
  Alert,
  type ComboboxStore,
} from '@mantine/core';
import type { SortingDistributionStatistics } from '../types/sortingDistribution.types';
import { QuantityPillButtons } from './QuantityPillButtons';

export interface InfoSectionProps {
  // Form fields
  item: string;
  ordered: string;
  productOptions: string[];

  // Statistics
  statistics: SortingDistributionStatistics;

  // Quantity filters
  uniqueQuantities: number[];
  selectedQuantity: number | null;
  onSelectQuantity: (quantity: number | null) => void;

  // Combobox store
  productSelectCombobox: ComboboxStore;

  // Actions
  onItemChange: (item: string) => void;
}

/**
 * Info Section Component
 * Displays product selection and calculated statistics
 */
export function InfoSection({
  item,
  ordered,
  productOptions,
  statistics,
  uniqueQuantities,
  selectedQuantity,
  onSelectQuantity,
  productSelectCombobox,
  onItemChange,
}: InfoSectionProps) {
  const SELECT_WIDTH_PX = 500;
  const ITEM_HEIGHT_PX = 36;
  const DROPDOWN_PADDING_PX = 16;
  const dropdownHeight = productOptions.length
    ? productOptions.length * ITEM_HEIGHT_PX + DROPDOWN_PADDING_PX
    : undefined;

  const totalDistribution = statistics.totalDistribution;
  const quantityDifference =
    selectedQuantity !== null ? selectedQuantity - totalDistribution : 0;
  const showQuantityAdjustment =
    selectedQuantity !== null && quantityDifference !== 0;
  const quantityAdjustmentLabel =
    quantityDifference > 0
      ? `Add ${quantityDifference}`
      : `Deduct ${Math.abs(quantityDifference)}`;
  const quantityAdjustmentColor = quantityDifference > 0 ? 'blue' : 'red';

  const focusSearchInputSafely = React.useCallback(() => {
    let attempts = 0;
    const tryFocus = () => {
      const searchInput = productSelectCombobox.searchRef.current;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
        return;
      }

      if (attempts >= 3) {
        productSelectCombobox.focusTarget();
        return;
      }

      attempts += 1;
      requestAnimationFrame(tryFocus);
    };

    tryFocus();
  }, [productSelectCombobox]);

  const Stat = ({
    label,
    value,
    color,
    emphasize,
  }: {
    label: string;
    value: string;
    color?: string;
    emphasize?: boolean;
  }) => (
    <Stack
      gap={4}
      align="flex-end"
      style={{ minWidth: '104px', flex: '0 0 auto' }}
    >
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
        {label}
      </Text>
      <Text
        size="sm"
        fw={emphasize ? 600 : 500}
        c={color}
        style={{ whiteSpace: 'nowrap' }}
      >
        {value}
      </Text>
    </Stack>
  );

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Flex
        gap="xl"
        justify="space-between"
        align="flex-end"
        wrap="wrap"
        style={{ rowGap: '0.75rem' }}
      >
        <Group
          gap="lg"
          align="flex-end"
          wrap="wrap"
          style={{ alignSelf: 'stretch', flex: '1 1 auto' }}
        >
          <Stack
            gap={6}
            style={{
              minWidth: '260px',
              maxWidth: `${SELECT_WIDTH_PX}px`,
              width: '100%',
              flex: '0 0 auto',
            }}
          >
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
              Product Code
            </Text>
            <Select
              value={item}
              onChange={(value) => onItemChange(value || '')}
              data={productOptions}
              placeholder="Select a product..."
              searchable
              clearable
              style={{ width: '100%' }}
              maxDropdownHeight={dropdownHeight}
              onDropdownOpen={() => {
                productSelectCombobox.updateSelectedOptionIndex('selected', {
                  scrollIntoView: true,
                });
                focusSearchInputSafely();
              }}
              comboboxProps={{
                withinPortal: true,
                store: productSelectCombobox,
                styles: {
                  dropdown: {
                    width: `${SELECT_WIDTH_PX}px`,
                    maxHeight: dropdownHeight ? `${dropdownHeight}px` : 'none',
                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
                  },
                },
              }}
            />
          </Stack>

          {uniqueQuantities.length > 0 && (
            <Group gap="xs" wrap="wrap" style={{ alignSelf: 'flex-end' }}>
              <QuantityPillButtons
                uniqueQuantities={uniqueQuantities}
                selectedQuantity={selectedQuantity}
                onSelectQuantity={onSelectQuantity}
              />
            </Group>
          )}
        </Group>

        <Flex
          align="flex-end"
          justify="center"
          style={{ flex: '1 1 200px', minHeight: '44px' }}
        >
          {showQuantityAdjustment && (
            <Alert
              color={quantityAdjustmentColor}
              variant="light"
              radius="md"
              style={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {quantityAdjustmentLabel}
            </Alert>
          )}
        </Flex>

        <Group
          gap="lg"
          align="flex-end"
          justify="flex-end"
          wrap="wrap"
          style={{ flex: '1 1 auto', columnGap: '1.75rem', rowGap: '0.75rem' }}
        >
          <Stat label="Ordered" value={(ordered || '0').toString()} />
          <Stat
            label="Total Customers"
            value={statistics.totalCustomers.toLocaleString()}
          />
          <Stat
            label="Customer w/ Order Qty"
            value={statistics.customerWithOrderQty.toLocaleString()}
          />
        </Group>
      </Flex>
    </Card>
  );
}
