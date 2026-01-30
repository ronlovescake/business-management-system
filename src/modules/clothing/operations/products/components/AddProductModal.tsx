'use client';

/**
 * Add/Edit Product Modal Component
 * Complex form with 15 fields and real-time financial calculations
 */

import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Group,
  Text,
  SimpleGrid,
  TextInput,
  Select,
  NumberInput,
  Button,
  Card,
  Loader,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { PolishedModal } from '@/components/modals/PolishedModal';
import type {
  ProductFormData,
  ProductCalculationResults,
} from '../types/product.types';
import {
  AGE_RANGE_START_OPTIONS,
  AGE_RANGE_END_OPTIONS,
  AGE_RANGE_UNIT_OPTIONS,
  UNIT_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from '../types/product.types';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import { queryKeys } from '@/lib/queryKeys';
import { paymentCardService } from '@/modules/settings/global/services/paymentCards.service';

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
  const handleSubmitClick = async () => {
    if (isSubmitting) {
      return;
    }

    const { showAlert, showConfirm } = await import('@/lib/alerts');

    // Guardrail: confirm Paid vs Unpaid before creating a product because it
    // drives accounting postings.
    if (!isEditMode) {
      const payment = (form.payment ?? '').trim();
      if (payment !== 'Paid' && payment !== 'Unpaid') {
        await showAlert({
          title: 'Payment required',
          message: 'Please choose Paid or Unpaid before saving this product.',
          type: 'warning',
        });
        return;
      }

      const confirmed = await showConfirm({
        title: 'Confirm payment status',
        message:
          payment === 'Paid'
            ? 'You are adding a new product that is already PAID to the supplier.'
            : 'You are adding a new product that is UNPAID (supplier will be paid later).',
        confirmButtonText: 'Yes, save product',
        cancelButtonText: 'Cancel',
        type: 'question',
      });

      if (!confirmed) {
        return;
      }
    }

    onSubmit();
  };

  const handleDateChange =
    (field: 'postingDate' | 'orderDate') => (value: Date | null) => {
      updateField(field, formatDateForInput(value));
    };

  const displayValue = (value: number) => {
    return value === 0 ? undefined : value;
  };

  const projectedProfitColor =
    calculations.projectedProfit < 0 ? 'red.6' : 'green.6';
  const profitMarginColor =
    calculations.projectedProfitPercent < 0 ? 'red.6' : 'green.6';

  const { data: paymentCards = [], isLoading: cardsLoading } = useQuery({
    queryKey: queryKeys.paymentCards.lists(),
    queryFn: () => paymentCardService.list(),
    staleTime: 5 * 60 * 1000,
  });

  const paymentCardOptions = useMemo(
    () =>
      paymentCards.map((card) => ({
        value: card.id,
        label: `${card.bank} • ${card.label} (${card.last4 ? `•••• ${card.last4}` : '••••'})`,
      })),
    [paymentCards]
  );

  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      size="50%"
      title={
        <Group gap="sm">
          <div>
            <Text size="xl" fw={600} c="gray.9">
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
        content: {
          backgroundColor: '#ffffff',
        },
        header: {
          backgroundColor: '#ffffff',
          borderRadius: '28px 28px 0 0',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        },
        title: {
          color: '#1f2937',
        },
        body: {
          backgroundColor: '#ffffff',
          '& input, & select, & textarea': {
            backgroundColor: '#ffffff',
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

            <div>
              <Text size="sm" fw={500} mb={4}>
                Age Range
              </Text>
              <Group gap="xs" align="flex-start">
                <Select
                  placeholder="Start"
                  size="md"
                  radius="md"
                  data={AGE_RANGE_START_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  allowDeselect
                  clearable
                  searchable
                  value={form.ageRangeStart || null}
                  onChange={(value) =>
                    updateField('ageRangeStart', value || '')
                  }
                  style={{ flex: 1 }}
                />
                <Select
                  placeholder="End"
                  size="md"
                  radius="md"
                  data={AGE_RANGE_END_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  allowDeselect
                  clearable
                  searchable
                  value={form.ageRangeEnd || null}
                  onChange={(value) => updateField('ageRangeEnd', value || '')}
                  style={{ flex: 1 }}
                />
                <Select
                  placeholder="Unit"
                  size="md"
                  radius="md"
                  data={AGE_RANGE_UNIT_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  allowDeselect
                  clearable
                  searchable
                  value={form.ageRangeUnit || null}
                  onChange={(value) => updateField('ageRangeUnit', value || '')}
                  style={{ flex: 1 }}
                />
              </Group>
            </div>

            <Select
              label="Unit"
              size="md"
              radius="md"
              data={UNIT_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
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
            <DateInput
              label="Posting Date"
              placeholder="Select posting date"
              size="md"
              radius="md"
              value={parseDateValue(form.postingDate)}
              onChange={handleDateChange('postingDate')}
              valueFormat="MMMM DD, YYYY"
              clearable
              {...COMMON_DATE_INPUT_PROPS}
            />

            <DateInput
              label="Order Date"
              placeholder="Select order date"
              size="md"
              radius="md"
              value={parseDateValue(form.orderDate)}
              onChange={handleDateChange('orderDate')}
              valueFormat="MMMM DD, YYYY"
              clearable
              {...COMMON_DATE_INPUT_PROPS}
            />

            <Select
              label="Payment"
              size="md"
              radius="md"
              data={PAYMENT_STATUS_OPTIONS.map((opt) => ({ ...opt }))}
              allowDeselect
              clearable
              value={form.payment || null}
              onChange={(value) => updateField('payment', value || '')}
            />
            <Select
              label="Payment Method"
              size="md"
              radius="md"
              data={PAYMENT_METHOD_OPTIONS.map((opt) => ({ ...opt }))}
              allowDeselect
              clearable
              value={form.paymentMethod || null}
              onChange={(value) => {
                updateField('paymentMethod', value || '');
                if (value !== 'CARD') {
                  updateField('paymentCardId', '');
                }
              }}
            />
            <Select
              label="Payment Card"
              size="md"
              radius="md"
              data={paymentCardOptions}
              allowDeselect
              searchable
              clearable
              disabled={form.paymentMethod !== 'CARD'}
              placeholder={
                cardsLoading ? 'Loading saved cards...' : 'Select saved card'
              }
              rightSection={cardsLoading ? <Loader size="xs" /> : undefined}
              value={form.paymentCardId || null}
              onChange={(value) => updateField('paymentCardId', value || '')}
            />
          </SimpleGrid>
        </div>

        {/* Pricing & Quantity Section */}
        <div>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            <NumberInput
              label="Unit Price"
              size="md"
              radius="md"
              leftSection="₱"
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              hideControls
              value={displayValue(form.unitPrice)}
              onChange={(value) => updateField('unitPrice', Number(value) || 0)}
            />

            <NumberInput
              label="Quantity"
              size="md"
              radius="md"
              min={0}
              hideControls
              value={displayValue(form.quantity)}
              onChange={(value) => updateField('quantity', Number(value) || 0)}
            />

            <NumberInput
              label="Exchange Rate"
              size="md"
              radius="md"
              decimalScale={2}
              fixedDecimalScale
              step={0.01}
              hideControls
              value={form.exchangeRates}
              onChange={(value) =>
                updateField('exchangeRates', Number(value) || 1)
              }
            />

            <Select
              label="Transaction Fee"
              description="Applies 2.99% when enabled"
              size="md"
              radius="md"
              data={[
                { value: 'YES', label: 'Yes' },
                { value: 'NO', label: 'No' },
              ]}
              value={form.applyTransactionFee ? 'YES' : 'NO'}
              onChange={(value) => {
                updateField('applyTransactionFee', value !== 'NO');
              }}
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
              hideControls
              value={displayValue(form.alibabaShippingCost)}
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
              hideControls
              value={displayValue(form.forwardersFee)}
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
              hideControls
              value={displayValue(form.lalamove)}
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
              hideControls
              value={displayValue(form.packagingCost)}
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
              hideControls
              value={displayValue(form.actualPrice)}
              onChange={(value) =>
                updateField('actualPrice', Number(value) || 0)
              }
            />
          </SimpleGrid>
        </div>

        {/* Bulk & Posting Details */}
        <div>
          <Group mb="sm">
            <div>
              <Text size="lg" fw={500} c="gray.7">
                Bulk & Posting Details
              </Text>
            </div>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            <TextInput
              label="Link to Post"
              size="md"
              radius="md"
              placeholder="https://example.com/post"
              value={form.linkToPost ?? ''}
              onChange={(e) =>
                updateField('linkToPost', e.currentTarget?.value || '')
              }
            />

            <NumberInput
              label="Bulk Quantity"
              size="md"
              radius="md"
              min={0}
              hideControls
              placeholder="0"
              value={displayValue(form.bulkQuantity)}
              onChange={(value) =>
                updateField('bulkQuantity', Number(value) || 0)
              }
            />

            <NumberInput
              label="Bulk Weight"
              size="md"
              radius="md"
              decimalScale={2}
              fixedDecimalScale
              hideControls
              placeholder="0.00"
              value={displayValue(form.bulkWeight)}
              onChange={(value) =>
                updateField('bulkWeight', Number(value) || 0)
              }
            />

            <NumberInput
              label="Weight Per Piece"
              size="md"
              radius="md"
              decimalScale={2}
              fixedDecimalScale
              hideControls
              placeholder="0.00"
              value={displayValue(calculations.weightPerPiece)}
              disabled
              styles={{
                input: {
                  backgroundColor: '#f8f9fa',
                  color: '#495057',
                },
              }}
            />
          </SimpleGrid>
        </div>

        {/* Financial Calculations Section */}
        <div>
          <Group mb="md">
            <Text size="lg" fw={500} c="gray.7">
              Financial Calculations & Business Intelligence
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} c="gray.7" mb="md">
                Suggested Price
              </Text>
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

            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} c="gray.7" mb="md">
                Projected Sales Total
              </Text>
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

            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} c="gray.7" mb="md">
                Projected Profit
              </Text>
              <Text
                size="xl"
                fw={700}
                c={projectedProfitColor}
                ta="center"
                mb="xs"
              >
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

            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} c="gray.7" mb="md">
                Profit Margin
              </Text>
              <Text
                size="xl"
                fw={700}
                c={profitMarginColor}
                ta="center"
                mb="xs"
              >
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

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} c="gray.7" mb="md">
                Base Price
              </Text>
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

            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} c="gray.7" mb="md">
                COGS
              </Text>
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

            <Card
              withBorder
              radius="md"
              padding="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} c="gray.7" mb="md">
                Total Markup
              </Text>
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
            onClick={handleSubmitClick}
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
