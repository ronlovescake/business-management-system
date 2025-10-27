'use client';

/**
 * Add/Edit Product Modal Component
 * Complex form with 15 fields and real-time financial calculations
 */

import { memo } from 'react';
import {
  Stack,
  Group,
  Text,
  ThemeIcon,
  SimpleGrid,
  TextInput,
  Select,
  NumberInput,
  Button,
  Card,
} from '@mantine/core';
import { PolishedModal } from '@/components/modals/PolishedModal';
import {
  IconPackage,
  IconCalendar,
  IconCreditCard,
  IconCurrencyPeso,
  IconTrendingUp,
  IconTrendingDown,
  IconPercentage,
  IconPlus,
  IconCheck,
} from '@tabler/icons-react';
import type {
  ProductFormData,
  ProductCalculationResults,
} from '../types/product.types';
import {
  AGE_RANGE_OPTIONS,
  UNIT_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '../types/product.types';

interface AddProductModalProps {
  opened: boolean;
  onClose: () => void;
  form: ProductFormData;
  updateField: (field: keyof ProductFormData, value: unknown) => void;
  calculations: ProductCalculationResults;
  onSubmit: () => void;
  isEditMode: boolean;
  isSubmitting?: boolean;
}

export const AddProductModal = memo(function AddProductModal({
  opened,
  onClose,
  form,
  updateField,
  calculations,
  onSubmit,
  isEditMode,
  isSubmitting = false,
}: AddProductModalProps) {
  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      size="50%"
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="gray">
            <IconPackage size={20} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600} c="gray.7">
              {isEditMode ? 'Edit Product' : 'Add New Product'}
            </Text>
            <Text size="sm" c="gray.6">
              {isEditMode
                ? 'Update the product information below'
                : 'Fill in the product information below'}
            </Text>
          </div>
        </Group>
      }
      styles={{
        body: {
          backgroundColor: 'var(--mantine-color-gray-0)',
          '& input, & select, & textarea': {
            backgroundColor: 'var(--mantine-color-white)',
          },
        },
      }}
    >
      <Stack gap={32}>
        {/* Basic Product Information Section */}
        <div>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            <TextInput
              label="Shipment Code"
              size="md"
              radius="md"
              value={form.shipmentCode}
              onChange={(e) =>
                updateField('shipmentCode', e.currentTarget?.value || '')
              }
            />

            <TextInput
              label="Product Name"
              withAsterisk
              size="md"
              radius="md"
              value={form.product}
              onChange={(e) =>
                updateField('product', e.currentTarget?.value || '')
              }
            />

            <Select
              label="Age Range"
              size="md"
              radius="md"
              data={AGE_RANGE_OPTIONS.map((opt) => ({ ...opt }))}
              allowDeselect
              clearable
              value={form.ageRange || null}
              onChange={(value) => updateField('ageRange', value || '')}
            />

            <Select
              label="Unit"
              size="md"
              radius="md"
              data={UNIT_OPTIONS.map((opt) => ({ ...opt }))}
              allowDeselect
              clearable
              value={form.unit || null}
              onChange={(value) => updateField('unit', value || '')}
            />
          </SimpleGrid>
        </div>

        {/* Date & Payment Information Section */}
        <div>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <TextInput
              label="Posting Date"
              type="date"
              size="md"
              radius="md"
              leftSection={<IconCalendar size={16} />}
              value={form.postingDate}
              onChange={(e) =>
                updateField('postingDate', e.currentTarget?.value || '')
              }
            />

            <TextInput
              label="Order Date"
              type="date"
              size="md"
              radius="md"
              leftSection={<IconCalendar size={16} />}
              value={form.orderDate}
              onChange={(e) =>
                updateField('orderDate', e.currentTarget?.value || '')
              }
            />

            <Select
              label="Payment"
              size="md"
              radius="md"
              leftSection={<IconCreditCard size={16} />}
              data={PAYMENT_STATUS_OPTIONS.map((opt) => ({ ...opt }))}
              allowDeselect
              clearable
              value={form.payment || null}
              onChange={(value) => updateField('payment', value || '')}
            />
          </SimpleGrid>
        </div>

        {/* Pricing & Quantity Section */}
        <div>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            <NumberInput
              label="Unit Price"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              value={form.unitPrice}
              onChange={(value) => updateField('unitPrice', Number(value) || 0)}
            />

            <NumberInput
              label="Quantity"
              size="md"
              radius="md"
              min={0}
              value={form.quantity}
              onChange={(value) => updateField('quantity', Number(value) || 0)}
            />

            <NumberInput
              label="Exchange Rate"
              size="md"
              radius="md"
              decimalScale={4}
              fixedDecimalScale
              step={0.0001}
              value={form.exchangeRates}
              onChange={(value) =>
                updateField('exchangeRates', Number(value) || 1)
              }
            />
          </SimpleGrid>
        </div>

        {/* Shipping & Additional Fees Section */}
        <div>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="lg">
            <NumberInput
              label="Alibaba Shipping Cost"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              value={form.alibabaShippingCost}
              onChange={(value) =>
                updateField('alibabaShippingCost', Number(value) || 0)
              }
            />

            <NumberInput
              label="Forwarder's Fee"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              value={form.forwardersFee}
              onChange={(value) =>
                updateField('forwardersFee', Number(value) || 0)
              }
            />

            <NumberInput
              label="Lalamove"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              value={form.lalamove}
              onChange={(value) => updateField('lalamove', Number(value) || 0)}
            />

            <NumberInput
              label="Packaging Cost"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              value={form.packagingCost}
              onChange={(value) =>
                updateField('packagingCost', Number(value) || 0)
              }
            />

            <NumberInput
              label="Actual Price"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              value={form.actualPrice}
              onChange={(value) =>
                updateField('actualPrice', Number(value) || 0)
              }
            />
          </SimpleGrid>
        </div>

        {/* Financial Calculations Section */}
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="gray">
              <IconCurrencyPeso size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="gray.7">
              Financial Calculations & Business Intelligence
            </Text>
          </Group>

          {/* First Row - Key Profit Metrics */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
            {/* Suggested Price Calculation */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                  <IconCurrencyPeso size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="gray.7">
                  Suggested Price
                </Text>
              </Group>
              <Text size="xl" fw={700} c="gray.8" ta="center" mb="xs">
                ₱
                {calculations.suggestedPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="gray.6" ta="center">
                Minimum selling price (122% markup)
              </Text>
            </Card>

            {/* Projected Sales Total */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="gray.7">
                  Projected Sales Total
                </Text>
              </Group>
              <Text size="xl" fw={700} c="gray.8" ta="center" mb="xs">
                ₱
                {calculations.projectedSales.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="gray.6" ta="center">
                Total revenue (Actual Price × Quantity)
              </Text>
            </Card>

            {/* Projected Profit */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="gray.7">
                  Projected Profit
                </Text>
              </Group>
              <Text size="xl" fw={700} c="gray.8" ta="center" mb="xs">
                ₱
                {calculations.projectedProfit.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="gray.6" ta="center">
                Expected profit (Revenue - Costs)
              </Text>
            </Card>

            {/* Profit Margin (Projected Profit %) */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                  <IconPercentage size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="gray.7">
                  Profit Margin
                </Text>
              </Group>
              <Text size="xl" fw={700} c="gray.8" ta="center" mb="xs">
                {calculations.projectedProfitPercent.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </Text>
              <Text size="xs" c="gray.6" ta="center">
                Profit as % of costs invested
              </Text>
            </Card>
          </SimpleGrid>

          {/* Second Row - Cost & Markup Metrics */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {/* Base Price */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                  <IconCurrencyPeso size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="gray.7">
                  Base Price
                </Text>
              </Group>
              <Text size="xl" fw={700} c="gray.8" ta="center" mb="xs">
                ₱
                {calculations.basePrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="gray.6" ta="center">
                Cost per item (COGS ÷ Quantity)
              </Text>
            </Card>

            {/* COGS (Cost of Goods Sold) */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                  <IconTrendingDown size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="gray.7">
                  COGS
                </Text>
              </Group>
              <Text size="xl" fw={700} c="gray.8" ta="center" mb="xs">
                ₱
                {calculations.cogs.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="gray.6" ta="center">
                Total cost to acquire & deliver
              </Text>
            </Card>

            {/* Total Markup */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="gray.7">
                  Total Markup
                </Text>
              </Group>
              <Text size="xl" fw={700} c="gray.8" ta="center" mb="xs">
                {calculations.totalMarkup.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </Text>
              <Text size="xs" c="gray.6" ta="center">
                Price increase from cost to selling
              </Text>
            </Card>
          </SimpleGrid>
        </div>

        {/* Action Buttons */}
        <Group
          justify="flex-end"
          mt={32}
          pt="xl"
          style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
        >
          <Button
            variant="subtle"
            size="md"
            radius="md"
            onClick={onClose}
            disabled={isSubmitting}
            styles={{
              root: {
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-gray-1)',
                },
              },
            }}
          >
            Cancel
          </Button>
          <Button
            size="md"
            radius="md"
            gradient={{ from: 'green', to: 'green.6', deg: 45 }}
            disabled={!form.product.trim() || isSubmitting}
            leftSection={
              isEditMode ? <IconCheck size={18} /> : <IconPlus size={18} />
            }
            onClick={onSubmit}
            loading={isSubmitting}
            styles={{
              root: {
                boxShadow: '0 4px 12px rgba(51, 217, 178, 0.2)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(51, 217, 178, 0.3)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease',
              },
            }}
          >
            {isEditMode ? 'Update Product' : 'Add Product'}
          </Button>
        </Group>
      </Stack>
    </PolishedModal>
  );
});
