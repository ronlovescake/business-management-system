'use client';

/**
 * Add/Edit Product Modal Component
 * Complex form with 15 fields and real-time financial calculations
 */

import {
  Modal,
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

export function AddProductModal({
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
    <Modal
      opened={opened}
      onClose={onClose}
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
      title={
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            radius="md"
            variant="light"
            color={isEditMode ? 'blue' : 'green'}
          >
            <IconPackage size={20} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600} c={isEditMode ? 'blue.8' : 'green.8'}>
              {isEditMode ? 'Edit Product' : 'Add New Product'}
            </Text>
            <Text size="sm" c="dimmed">
              {isEditMode
                ? 'Update the product information below'
                : 'Fill in the product information below'}
            </Text>
          </div>
        </Group>
      }
    >
      <Stack gap="lg">
        {/* Basic Product Information Section */}
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="green">
              <IconPackage size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="green.7">
              Basic Product Information
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <TextInput
              label="Shipment Code"
              placeholder="e.g. KPC 23930A-00173"
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
              value={form.shipmentCode}
              onChange={(e) =>
                updateField('shipmentCode', e.currentTarget?.value || '')
              }
            />

            <TextInput
              label="Product Name"
              placeholder="e.g. Premium T-Shirt"
              withAsterisk
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
              value={form.product}
              onChange={(e) =>
                updateField('product', e.currentTarget?.value || '')
              }
            />

            <Select
              label="Age Range"
              placeholder="Select age range"
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
              data={AGE_RANGE_OPTIONS.map((opt) => ({ ...opt }))}
              allowDeselect
              clearable
              value={form.ageRange || null}
              onChange={(value) => updateField('ageRange', value || '')}
            />

            <Select
              label="Unit"
              placeholder="Select unit"
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
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
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="blue">
              <IconCalendar size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="blue.7">
              Date & Payment Information
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="Posting Date"
              placeholder="YYYY-MM-DD"
              type="date"
              size="md"
              radius="md"
              leftSection={<IconCalendar size={16} />}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                },
              }}
              value={form.postingDate}
              onChange={(e) =>
                updateField('postingDate', e.currentTarget?.value || '')
              }
            />

            <TextInput
              label="Order Date"
              placeholder="YYYY-MM-DD"
              type="date"
              size="md"
              radius="md"
              leftSection={<IconCalendar size={16} />}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                },
              }}
              value={form.orderDate}
              onChange={(e) =>
                updateField('orderDate', e.currentTarget?.value || '')
              }
            />

            <Select
              label="Payment"
              placeholder="Select payment status"
              size="md"
              radius="md"
              leftSection={<IconCreditCard size={16} />}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                },
              }}
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
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="orange">
              <IconCurrencyPeso size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="orange.7">
              Pricing & Quantity
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <NumberInput
              label="Unit Price"
              placeholder="0.00"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-orange-5)',
                  },
                },
              }}
              value={form.unitPrice}
              onChange={(value) => updateField('unitPrice', Number(value) || 0)}
            />

            <NumberInput
              label="Quantity"
              placeholder="0"
              size="md"
              radius="md"
              min={0}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-orange-5)',
                  },
                },
              }}
              value={form.quantity}
              onChange={(value) => updateField('quantity', Number(value) || 0)}
            />

            <NumberInput
              label="Exchange Rate"
              placeholder="1.00"
              size="md"
              radius="md"
              decimalScale={4}
              fixedDecimalScale
              step={0.0001}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-orange-5)',
                  },
                },
              }}
              value={form.exchangeRates}
              onChange={(value) =>
                updateField('exchangeRates', Number(value) || 1)
              }
            />
          </SimpleGrid>
        </div>

        {/* Shipping & Additional Fees Section */}
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="purple">
              <IconTrendingUp size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="purple.7">
              Shipping & Additional Fees
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="md">
            <NumberInput
              label="Alibaba Shipping Cost"
              placeholder="0.00"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-purple-5)',
                  },
                },
              }}
              value={form.alibabaShippingCost}
              onChange={(value) =>
                updateField('alibabaShippingCost', Number(value) || 0)
              }
            />

            <NumberInput
              label="Forwarder's Fee"
              placeholder="0.00"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-purple-5)',
                  },
                },
              }}
              value={form.forwardersFee}
              onChange={(value) =>
                updateField('forwardersFee', Number(value) || 0)
              }
            />

            <NumberInput
              label="Lalamove"
              placeholder="0.00"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-purple-5)',
                  },
                },
              }}
              value={form.lalamove}
              onChange={(value) => updateField('lalamove', Number(value) || 0)}
            />

            <NumberInput
              label="Packaging Cost"
              placeholder="0.00"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-purple-5)',
                  },
                },
              }}
              value={form.packagingCost}
              onChange={(value) =>
                updateField('packagingCost', Number(value) || 0)
              }
            />

            <NumberInput
              label="Actual Price"
              placeholder="0.00"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-purple-5)',
                  },
                },
              }}
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
            <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
              <IconCurrencyPeso size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="indigo.7">
              Financial Calculations & Business Intelligence
            </Text>
          </Group>

          {/* First Row - Key Profit Metrics */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="md">
            {/* Suggested Price Calculation */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-indigo-0)',
                borderColor: 'var(--mantine-color-indigo-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
                  <IconCurrencyPeso size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="indigo.7">
                  Suggested Price
                </Text>
              </Group>
              <Text size="xl" fw={700} c="indigo.8" ta="center" mb="xs">
                ₱
                {calculations.suggestedPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Minimum selling price (122% markup)
              </Text>
            </Card>

            {/* Projected Sales Total */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-green-0)',
                borderColor: 'var(--mantine-color-green-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="green">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="green.7">
                  Projected Sales Total
                </Text>
              </Group>
              <Text size="xl" fw={700} c="green.8" ta="center" mb="xs">
                ₱
                {calculations.projectedSales.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Total revenue (Actual Price × Quantity)
              </Text>
            </Card>

            {/* Projected Profit */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-teal-0)',
                borderColor: 'var(--mantine-color-teal-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="teal">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="teal.7">
                  Projected Profit
                </Text>
              </Group>
              <Text size="xl" fw={700} c="teal.8" ta="center" mb="xs">
                ₱
                {calculations.projectedProfit.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Expected profit (Revenue - Costs)
              </Text>
            </Card>

            {/* Profit Margin (Projected Profit %) */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-blue-0)',
                borderColor: 'var(--mantine-color-blue-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                  <IconPercentage size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="blue.7">
                  Profit Margin
                </Text>
              </Group>
              <Text size="xl" fw={700} c="blue.8" ta="center" mb="xs">
                {calculations.projectedProfitPercent.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </Text>
              <Text size="xs" c="dimmed" ta="center">
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
                backgroundColor: 'var(--mantine-color-blue-0)',
                borderColor: 'var(--mantine-color-blue-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                  <IconCurrencyPeso size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="blue.7">
                  Base Price
                </Text>
              </Group>
              <Text size="xl" fw={700} c="blue.8" ta="center" mb="xs">
                ₱
                {calculations.basePrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Cost per item (COGS ÷ Quantity)
              </Text>
            </Card>

            {/* COGS (Cost of Goods Sold) */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-red-0)',
                borderColor: 'var(--mantine-color-red-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="red">
                  <IconTrendingDown size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="red.7">
                  COGS
                </Text>
              </Group>
              <Text size="xl" fw={700} c="red.8" ta="center" mb="xs">
                ₱
                {calculations.cogs.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Total cost to acquire & deliver
              </Text>
            </Card>

            {/* Total Markup */}
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-violet-0)',
                borderColor: 'var(--mantine-color-violet-3)',
              }}
            >
              <Group justify="space-between" align="center" mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="violet">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} c="violet.7">
                  Total Markup
                </Text>
              </Group>
              <Text size="xl" fw={700} c="violet.8" ta="center" mb="xs">
                {calculations.totalMarkup.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Price increase from cost to selling
              </Text>
            </Card>
          </SimpleGrid>
        </div>

        {/* Action Buttons */}
        <Group
          justify="flex-end"
          mt="xl"
          pt="md"
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
    </Modal>
  );
}
