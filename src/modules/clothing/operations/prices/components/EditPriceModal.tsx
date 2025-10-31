import { memo } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  NumberInput,
  Button,
  ThemeIcon,
  SimpleGrid,
} from '@mantine/core';
import {
  IconAdjustments,
  IconCurrencyPeso,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { PriceFormData } from '../types/price.types';
import { logger } from '@/lib/logger';

interface EditPriceModalProps {
  opened: boolean;
  onClose: () => void;
  form: PriceFormData;
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
 * Modal for editing existing prices with tier support
 */
export const EditPriceModal = memo(function EditPriceModal({
  opened,
  onClose,
  form,
  onTierChange,
  onPriceAdjustmentChange,
  onSubmit,
  onReset,
}: EditPriceModalProps) {
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

      notifications.show({
        title: '🎉 Price Updated Successfully!',
        message: `${form.productCode} has been updated in your pricing database`,
        color: 'blue',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      logger.error('Failed to update price:', error);
      notifications.show({
        title: '❌ Failed to Update Price',
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
          backgroundColor: 'var(--mantine-color-blue-0)',
          borderRadius: '12px 12px 0 0',
          padding: '24px 32px 16px 32px',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        },
        title: {
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--mantine-color-blue-8)',
        },
        body: {
          padding: '32px',
          backgroundColor: 'var(--mantine-color-gray-0)',
        },
        close: {
          color: 'var(--mantine-color-blue-6)',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-blue-1)',
          },
        },
      }}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="blue">
            <IconAdjustments size={20} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600} c="blue.8">
              Edit Price
            </Text>
            <Text size="sm" c="dimmed">
              Update pricing information for {form.productCode}
            </Text>
          </div>
        </Group>
      }
    >
      <Stack gap="lg">
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="blue">
              <IconCurrencyPeso size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="blue.7">
              Product Pricing Information
            </Text>
          </Group>

          <TextInput
            label="Product Code"
            placeholder="e.g. TSH-001"
            withAsterisk
            size="md"
            radius="md"
            readOnly
            disabled
            styles={{
              label: { fontWeight: 500, marginBottom: 8 },
              input: {
                borderWidth: 2,
                backgroundColor: 'var(--mantine-color-gray-1)',
                color: 'var(--mantine-color-gray-7)',
                cursor: 'not-allowed',
              },
            }}
            value={form.productCode}
          />

          {/* Pricing Tiers */}
          <div style={{ marginTop: 24 }}>
            <Text size="lg" fw={500} c="blue.7" mb="md">
              Pricing Tiers
            </Text>

            {tierKeys.map((tierKey, index) => {
              const tier = form.tiers[index] ?? {
                lowerLimit: 0,
                upperLimit: 0,
                price: 0,
              };

              // For edit modal, enable tier if any of its values are > 0 (existing data)
              // or if it's tier 1
              const hasTierData =
                tier.lowerLimit > 0 || tier.upperLimit > 0 || tier.price > 0;
              const isPreviousTierComplete =
                index === 0
                  ? true
                  : form.tiers[index - 1].lowerLimit > 0 &&
                    form.tiers[index - 1].upperLimit > 0 &&
                    form.tiers[index - 1].price > 0;
              const isTierEnabled =
                index === 0 || hasTierData || isPreviousTierComplete;

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
                    Tier {index + 1}{' '}
                    {!isTierEnabled && '(Complete previous tier first)'}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      label="Lower Limit"
                      placeholder={
                        index === 0 ? '1' : `> ${previousLowerLimit}`
                      }
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
                        label: { fontWeight: 500, marginBottom: 8 },
                        input: {
                          borderWidth: 2,
                          '&:focus': {
                            borderColor: 'var(--mantine-color-blue-5)',
                          },
                          backgroundColor: !isTierEnabled
                            ? 'var(--mantine-color-gray-1)'
                            : undefined,
                          color: !isTierEnabled
                            ? 'var(--mantine-color-gray-5)'
                            : undefined,
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
                      placeholder="Auto-calculated"
                      size="md"
                      radius="md"
                      hideControls
                      readOnly
                      tabIndex={-1}
                      styles={{
                        label: { fontWeight: 500, marginBottom: 8 },
                        input: {
                          borderWidth: 2,
                          backgroundColor: 'var(--mantine-color-gray-1)',
                          color: 'var(--mantine-color-gray-7)',
                          cursor: 'not-allowed',
                        },
                      }}
                      value={tier.upperLimit}
                    />

                    <NumberInput
                      label="Price"
                      placeholder="Auto-calculated"
                      size="md"
                      radius="md"
                      prefix="₱"
                      hideControls
                      readOnly
                      tabIndex={-1}
                      styles={{
                        label: { fontWeight: 500, marginBottom: 8 },
                        input: {
                          borderWidth: 2,
                          backgroundColor: 'var(--mantine-color-gray-1)',
                          color: 'var(--mantine-color-gray-7)',
                          cursor: 'not-allowed',
                        },
                      }}
                      value={tier.price}
                    />
                  </SimpleGrid>
                </div>
              );
            })}
          </div>

          <NumberInput
            label="Price Adjustment"
            placeholder="0"
            size="md"
            radius="md"
            prefix="₱"
            description="Positive for increases, negative for decreases"
            mt="md"
            hideControls
            styles={{
              label: { fontWeight: 500, marginBottom: 8 },
              input: {
                borderWidth: 2,
                '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
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
            gradient={{ from: 'blue', to: 'blue.6', deg: 45 }}
            disabled={isSubmitDisabled}
            leftSection={<IconCheck size={18} />}
            styles={{
              root: {
                boxShadow: '0 4px 12px rgba(34, 139, 230, 0.2)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(34, 139, 230, 0.3)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease',
              },
            }}
            onClick={handleSubmit}
          >
            Save Changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
});
