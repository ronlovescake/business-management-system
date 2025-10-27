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
import { IconPlus, IconCurrencyPeso, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { PriceFormData } from '../types/price.types';
import { logger } from '@/lib/logger';

interface AddPriceModalProps {
  opened: boolean;
  onClose: () => void;
  form: PriceFormData;
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

      notifications.show({
        title: '🎉 Price Added Successfully!',
        message: `${form.productCode} has been added to your pricing database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      logger.error('Failed to add price:', error);
      notifications.show({
        title: '❌ Failed to Add Price',
        message: 'Could not save the price to database. Please try again.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  const isSubmitDisabled =
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
          <ThemeIcon size="lg" radius="md" variant="light" color="green">
            <IconPlus size={20} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600} c="green.8">
              Add New Price
            </Text>
            <Text size="sm" c="dimmed">
              Set pricing information for a product
            </Text>
          </div>
        </Group>
      }
    >
      <Stack gap="lg">
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="green">
              <IconCurrencyPeso size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="green.7">
              Product Pricing Information
            </Text>
          </Group>

          <TextInput
            label="Product Code"
            placeholder="e.g. TSH-001"
            withAsterisk
            size="md"
            radius="md"
            styles={{
              label: { fontWeight: 500, marginBottom: 8 },
              input: {
                borderWidth: 2,
                '&:focus': { borderColor: 'var(--mantine-color-green-5)' },
              },
            }}
            value={form.productCode}
            onChange={(e) => onProductCodeChange(e.target.value)}
          />

          {/* Pricing Tiers */}
          <div style={{ marginTop: 24 }}>
            <Text size="lg" fw={500} c="green.7" mb="md">
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
                    Tier {index + 1}{' '}
                    {!isTierEnabled &&
                      (index === 0
                        ? '(Fill Product Code first)'
                        : '(Complete previous tier first)')}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      label="Lower Limit"
                      placeholder={
                        index === 0 ? '1' : `> ${previousLowerLimit}`
                      }
                      size="md"
                      radius="md"
                      min={index === 0 ? 0 : previousLowerLimit + 1}
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
                            borderColor: 'var(--mantine-color-green-5)',
                          },
                          backgroundColor: !isTierEnabled
                            ? 'var(--mantine-color-gray-1)'
                            : undefined,
                          color: !isTierEnabled
                            ? 'var(--mantine-color-gray-5)'
                            : undefined,
                        },
                      }}
                      value={tier.lowerLimit}
                      onChange={(value) =>
                        onTierChange(index, 'lowerLimit', Number(value) || 0)
                      }
                    />

                    <NumberInput
                      label="Upper Limit"
                      placeholder="100"
                      size="md"
                      radius="md"
                      min={0}
                      hideControls
                      disabled={!isTierEnabled}
                      styles={{
                        label: { fontWeight: 500, marginBottom: 8 },
                        input: {
                          borderWidth: 2,
                          '&:focus': {
                            borderColor: 'var(--mantine-color-green-5)',
                          },
                          backgroundColor: !isTierEnabled
                            ? 'var(--mantine-color-gray-1)'
                            : undefined,
                          color: !isTierEnabled
                            ? 'var(--mantine-color-gray-5)'
                            : undefined,
                        },
                      }}
                      value={tier.upperLimit}
                      onChange={(value) =>
                        onTierChange(index, 'upperLimit', Number(value) || 0)
                      }
                    />

                    <NumberInput
                      label="Price"
                      placeholder="₱350"
                      size="md"
                      radius="md"
                      prefix="₱"
                      min={0}
                      hideControls
                      disabled={!isTierEnabled}
                      styles={{
                        label: { fontWeight: 500, marginBottom: 8 },
                        input: {
                          borderWidth: 2,
                          '&:focus': {
                            borderColor: 'var(--mantine-color-green-5)',
                          },
                          backgroundColor: !isTierEnabled
                            ? 'var(--mantine-color-gray-1)'
                            : undefined,
                          color: !isTierEnabled
                            ? 'var(--mantine-color-gray-5)'
                            : undefined,
                        },
                      }}
                      value={tier.price}
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
                '&:focus': { borderColor: 'var(--mantine-color-green-5)' },
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
