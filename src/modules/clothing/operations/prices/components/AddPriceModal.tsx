import { memo } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Select,
  NumberInput,
  Button,
  SimpleGrid,
} from '@mantine/core';
import { IconPlus, IconCheck } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import type { PriceFormData } from '../types/price.types';
import { logger } from '@/lib/logger';

interface AddPriceModalProps {
  opened: boolean;
  onClose: () => void;
  form: PriceFormData;
  productCodeOptions: string[];
  onProductCodeChange: (value: string) => void;
  onTierChange: (
    index: number,
    field: 'lowerLimit' | 'upperLimit' | 'price',
    value: number
  ) => void;
  onPriceAdjustmentChange: (value: number) => void;
  onSubmit: () => Promise<void>;
  onReset: () => void;
}

/**
 * Modal for adding new prices with tier support
 */
export const AddPriceModal = memo(function AddPriceModal({
  opened,
  onClose,
  form,
  productCodeOptions,
  onProductCodeChange,
  onTierChange,
  onPriceAdjustmentChange,
  onSubmit,
  onReset,
}: AddPriceModalProps) {
  const tierKeys = ['tier-1', 'tier-2', 'tier-3', 'tier-4'] as const;

  const handleClose = () => {
    onReset();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      await onSubmit();
      onReset();
      onClose();

      showNotification({
        title: '🎉 Price Added Successfully!',
        message: `${form.productCode} has been added to your pricing database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      logger.error('Failed to add price:', error);
      showNotification({
        title: '❌ Failed to Add Price',
        message: 'Could not save the price to database. Please try again.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  // Check if any tier has validation errors
  const hasValidationErrors = form.tiers.some((tier, index) => {
    if (index === 0) {
      return false; // First tier has no previous tier to validate against
    }
    const previousTier = form.tiers[index - 1];
    const previousLowerLimit = previousTier?.lowerLimit ?? 0;
    return tier.lowerLimit > 0 && tier.lowerLimit <= previousLowerLimit;
  });

  const isSubmitDisabled =
    hasValidationErrors ||
    !form.productCode.trim() ||
    !form.tiers.some(
      (tier) => tier.lowerLimit > 0 || tier.upperLimit > 0 || tier.price > 0
    );

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={true}
      size="lg"
      radius="lg"
      shadow="xl"
      centered
      padding="xl"
      styles={{
        header: {
          backgroundColor: '#ffffff',
          borderRadius: '12px 12px 0 0',
          padding: '24px 32px 16px 32px',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        },
        title: {
          fontSize: '24px',
          fontWeight: 600,
          color: '#1f2937',
        },
        body: {
          padding: '32px',
          backgroundColor: '#ffffff',
        },
        close: {
          color: '#4b5563',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-gray-1)',
          },
        },
      }}
      title={
        <Group gap="sm">
          <Text size="xl" fw={600} c="gray.9">
            Add New Price
          </Text>
        </Group>
      }
    >
      <Stack gap="lg">
        <div>
          <Group mb="md">
            <Text size="lg" fw={500} c="gray.9">
              Product Pricing Information
            </Text>
          </Group>

          <Select
            label="Product Code"
            placeholder="Select or search product code"
            withAsterisk
            size="md"
            radius="md"
            searchable
            clearable
            data={productCodeOptions}
            styles={{
              label: { fontWeight: 500, marginBottom: 8, color: '#374151' },
              input: {
                borderWidth: 2,
                '&:focus': { borderColor: '#4b5563' },
              },
            }}
            value={form.productCode}
            onChange={(value) => onProductCodeChange(value || '')}
          />

          {/* Pricing Tiers */}
          <div style={{ marginTop: 24 }}>
            <Text size="lg" fw={500} c="gray.9" mb="md">
              Pricing Tiers
            </Text>

            {tierKeys.map((tierKey, index) => {
              const tier = form.tiers[index] ?? {
                lowerLimit: 0,
                upperLimit: 0,
                price: 0,
              };
              // Check if this tier should be enabled
              const isProductCodeFilled = form.productCode.trim().length > 0;
              const isPreviousTierComplete =
                index === 0
                  ? true
                  : form.tiers[index - 1].lowerLimit > 0 &&
                    form.tiers[index - 1].upperLimit > 0 &&
                    form.tiers[index - 1].price > 0;
              const isTierEnabled =
                isProductCodeFilled && isPreviousTierComplete;
              const previousTier = index > 0 ? form.tiers[index - 1] : null;
              const previousLowerLimit = previousTier?.lowerLimit ?? 0;
              const tierHasLowerLimitError =
                index > 0 &&
                tier.lowerLimit > 0 &&
                tier.lowerLimit <= previousLowerLimit;

              return (
                <div key={tierKey} style={{ marginBottom: 16 }}>
                  <Text
                    size="sm"
                    fw={500}
                    mb="xs"
                    c={isTierEnabled ? 'dimmed' : 'gray.5'}
                  >
                    Tier {index + 1}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      label="Lower Limit"
                      size="md"
                      radius="md"
                      hideControls
                      disabled={!isTierEnabled}
                      error={
                        tierHasLowerLimitError
                          ? `Must be greater than ${previousLowerLimit}`
                          : null
                      }
                      styles={{
                        label: {
                          fontWeight: 500,
                          marginBottom: 8,
                          color: '#374151',
                        },
                        input: {
                          borderWidth: 2,
                          '&:focus': {
                            borderColor: '#4b5563',
                          },
                          backgroundColor: !isTierEnabled
                            ? 'var(--mantine-color-gray-1)'
                            : undefined,
                          color: !isTierEnabled
                            ? 'var(--mantine-color-gray-5)'
                            : '#1f2937',
                        },
                      }}
                      value={
                        tier.lowerLimit === 0 ? undefined : tier.lowerLimit
                      }
                      onChange={(value) =>
                        onTierChange(index, 'lowerLimit', Number(value) || 0)
                      }
                    />

                    <NumberInput
                      label="Upper Limit"
                      size="md"
                      radius="md"
                      hideControls
                      readOnly
                      tabIndex={-1}
                      styles={{
                        label: {
                          fontWeight: 500,
                          marginBottom: 8,
                          color: '#374151',
                        },
                        input: {
                          borderWidth: 2,
                          backgroundColor: 'var(--mantine-color-gray-1)',
                          color: '#4b5563',
                          cursor: 'not-allowed',
                        },
                      }}
                      value={
                        tier.upperLimit === 0 ? undefined : tier.upperLimit
                      }
                    />

                    <NumberInput
                      label="Price"
                      size="md"
                      radius="md"
                      prefix="₱"
                      hideControls
                      disabled={!isTierEnabled}
                      styles={{
                        label: {
                          fontWeight: 500,
                          marginBottom: 8,
                          color: '#374151',
                        },
                        input: {
                          borderWidth: 2,
                          backgroundColor: !isTierEnabled
                            ? 'var(--mantine-color-gray-1)'
                            : undefined,
                          color: !isTierEnabled ? '#4b5563' : '#1f2937',
                        },
                      }}
                      value={tier.price === 0 ? undefined : tier.price}
                      onChange={(value) =>
                        onTierChange(index, 'price', Number(value) || 0)
                      }
                    />
                  </SimpleGrid>
                </div>
              );
            })}
          </div>

          <NumberInput
            label="Price Adjustment"
            size="md"
            radius="md"
            prefix="₱"
            mt="md"
            hideControls
            styles={{
              label: { fontWeight: 500, marginBottom: 8, color: '#374151' },
              input: {
                borderWidth: 2,
                '&:focus': { borderColor: '#4b5563' },
              },
            }}
            value={form.priceAdjustment}
            onChange={(value) => onPriceAdjustmentChange(Number(value) || 0)}
          />
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
            onClick={handleClose}
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
            disabled={isSubmitDisabled}
            leftSection={<IconPlus size={18} />}
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
            onClick={handleSubmit}
          >
            Add Price
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
});
