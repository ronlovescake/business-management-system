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
  Popover,
  Box,
  Switch,
} from '@mantine/core';
import Swal from 'sweetalert2';
import type { SortingDistributionStatistics } from '../types/sortingDistribution.types';
import { QuantityPillButtons } from './QuantityPillButtons';
import classes from './InfoSection.module.css';

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

  // Ref for focusing product select
  productSelectRef?: React.RefObject<HTMLInputElement>;

  // Actions
  onItemChange: (item: string) => void;

  // Customer notes
  customerNotes: CustomerNote[];

  // Controls
  includeAllProducts: boolean;
  onToggleIncludeAllProducts: (value: boolean) => void;
}

export interface CustomerNote {
  id: string;
  customer: string;
  note: string;
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
  productSelectRef,
  onItemChange,
  customerNotes,
  includeAllProducts,
  onToggleIncludeAllProducts,
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

  const [notesOpened, setNotesOpened] = React.useState(false);

  const toggleNotes = () => {
    setNotesOpened((prev) => !prev);
  };

  const closeNotes = () => {
    setNotesOpened(false);
  };

  const handleNotesKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleNotes();
    }
  };

  // Test SweetAlert for quantity mismatch
  React.useEffect(() => {
    if (showQuantityAdjustment) {
      const alertText = quantityAdjustmentLabel;

      // Inject rotating animation CSS for icon
      const styleId = 'rotating-icon-animation';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .swal2-icon.swal2-info.rotate-icon,
          .swal2-icon.swal2-warning.rotate-icon {
            animation: rotateY 2s infinite linear !important;
          }
          
          @keyframes rotateY {
            to {
              transform: rotateY(360deg);
            }
          }
          
          /* Fade in/out animation */
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          
          @keyframes fadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }
          
          .swal2-show {
            animation: fadeIn 0.3s !important;
          }
          
          .swal2-hide {
            animation: fadeOut 0.3s !important;
          }
        `;
        document.head.appendChild(style);
      }

      Swal.fire({
        html: `<div style="font-size: 24px; font-weight: bold;">${alertText}</div>`,
        icon: quantityDifference > 0 ? 'info' : 'warning',
        iconColor: quantityDifference > 0 ? '#228be6' : '#fa5252',
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: true,
        backdrop: false,
        position: 'top',
        showClass: {
          popup: 'swal2-show',
        },
        hideClass: {
          popup: 'swal2-hide',
        },
        customClass: {
          container: 'swal-no-block',
          icon: 'rotate-icon',
          popup: 'swal-shadow',
        },
        didOpen: () => {
          // Apply drop shadow and reduce height
          const popup = document.querySelector('.swal2-popup');
          if (popup instanceof HTMLElement) {
            popup.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
            popup.style.padding = '1rem 1.25rem';
          }

          // Reduce icon size
          const icon = document.querySelector('.swal2-icon');
          if (icon instanceof HTMLElement) {
            icon.style.width = '3.5rem';
            icon.style.height = '3.5rem';
            icon.style.margin = '0.75rem auto';
          }

          // Reduce text spacing
          const htmlContainer = document.querySelector('.swal2-html-container');
          if (htmlContainer instanceof HTMLElement) {
            htmlContainer.style.margin = '0.75rem 0 0 0';
          }
        },
      });
    } else {
      // Close the alert when mismatch is resolved
      if (Swal.isVisible()) {
        Swal.close();
      }
    }

    return () => {
      if (Swal.isVisible()) {
        Swal.close();
      }
    };
  }, [showQuantityAdjustment, quantityAdjustmentLabel, quantityDifference]);

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
          <Switch
            label="Show all products"
            size="md"
            checked={includeAllProducts}
            onChange={(event) =>
              onToggleIncludeAllProducts(event.currentTarget.checked)
            }
            style={{
              alignSelf: 'flex-end',
              minWidth: 'fit-content',
            }}
          />
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
              ref={productSelectRef}
              comboboxProps={{
                withinPortal: true,
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
          align="center"
          gap="md"
          style={{ flex: '1 1 320px', minHeight: '44px', width: '100%' }}
        >
          <Box
            style={{
              display: 'flex',
              flex: '1 1 auto',
              justifyContent: 'flex-end',
              marginLeft: 'auto',
            }}
          >
            {customerNotes.length > 0 && (
              <Popover
                width={360}
                trapFocus={false}
                position="bottom"
                shadow="lg"
                radius="md"
                opened={notesOpened}
                onClose={closeNotes}
              >
                <Popover.Target>
                  <Alert
                    color="yellow"
                    variant="outline"
                    radius="md"
                    className={classes.notesAlert}
                    onClick={toggleNotes}
                    onKeyDown={handleNotesKeyDown}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                  >
                    <Text
                      fw={600}
                      tt="uppercase"
                      size="sm"
                      color="yellow.7"
                      component="span"
                      mr={6}
                    >
                      Notes / Request:
                    </Text>
                    <Text
                      size="sm"
                      fw={500}
                      component="span"
                      style={{ textDecoration: 'underline' }}
                    >
                      Click here to view
                    </Text>
                  </Alert>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="sm" maw={320}>
                    <Text fw={600} size="sm">
                      Customer notes ({customerNotes.length})
                    </Text>
                    {customerNotes.map((noteEntry, noteIndex) => (
                      <Stack gap={4} key={noteEntry.id}>
                        <Text fw={600} size="sm">
                          {noteIndex + 1}. {noteEntry.customer}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {noteEntry.note}
                        </Text>
                      </Stack>
                    ))}
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            )}
          </Box>
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
