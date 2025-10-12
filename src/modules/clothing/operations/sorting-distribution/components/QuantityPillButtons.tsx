/**
 * Quantity Pill Buttons Component
 *
 * Displays pill buttons for unique order quantities.
 * Clicking a button sets the selected quantity for distribution calculations.
 */

import React from 'react';
import { Group, Button } from '@mantine/core';

export interface QuantityPillButtonsProps {
  uniqueQuantities: number[];
  selectedQuantity: number | null;
  onSelectQuantity: (quantity: number | null) => void;
}

/**
 * Quantity Pill Buttons Component
 * Displays clickable pill buttons for each unique order quantity
 */
export function QuantityPillButtons({
  uniqueQuantities,
  selectedQuantity,
  onSelectQuantity,
}: QuantityPillButtonsProps) {
  if (uniqueQuantities.length === 0) {
    return null;
  }

  return (
    <Group gap="xs">
      {uniqueQuantities.map((qty) => (
        <Button
          key={qty}
          size="sm"
          variant={selectedQuantity === qty ? 'filled' : 'outline'}
          onClick={() =>
            onSelectQuantity(selectedQuantity === qty ? null : qty)
          }
        >
          {qty}
        </Button>
      ))}
    </Group>
  );
}
