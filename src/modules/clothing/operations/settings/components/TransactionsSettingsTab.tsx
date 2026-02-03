'use client';

/**
 * TransactionsSettingsTab Component
 *
 * Allows users to configure transactions page behavior:
 * - Scroll to last N non-empty rows on page load
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Text,
  Button,
  Paper,
  Group,
  Loader,
  Switch,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { formatDateTime } from '@/lib/formatters';
import Swal from 'sweetalert2';

interface TransactionsSettings {
  id: string;
  unitPriceReadOnly: boolean;
  lineTotalReadOnly: boolean;
  invoiceDateReadOnly: boolean;
  packedDateReadOnly: boolean;
  shipmentCodeReadOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

type ReadOnlySettings = Pick<
  TransactionsSettings,
  | 'unitPriceReadOnly'
  | 'lineTotalReadOnly'
  | 'invoiceDateReadOnly'
  | 'packedDateReadOnly'
  | 'shipmentCodeReadOnly'
>;

const defaultReadOnlySettings: ReadOnlySettings = {
  unitPriceReadOnly: true,
  lineTotalReadOnly: true,
  invoiceDateReadOnly: true,
  packedDateReadOnly: true,
  shipmentCodeReadOnly: true,
};

export function TransactionsSettingsTab() {
  const [settings, setSettings] = useState<TransactionsSettings | null>(null);
  // scrollToRows removed
  const [readOnlyColumns, setReadOnlyColumns] = useState<ReadOnlySettings>(
    defaultReadOnlySettings
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const extractReadOnlySettings = (data: Partial<TransactionsSettings>) => ({
    unitPriceReadOnly:
      data.unitPriceReadOnly ?? defaultReadOnlySettings.unitPriceReadOnly,
    lineTotalReadOnly:
      data.lineTotalReadOnly ?? defaultReadOnlySettings.lineTotalReadOnly,
    invoiceDateReadOnly:
      data.invoiceDateReadOnly ?? defaultReadOnlySettings.invoiceDateReadOnly,
    packedDateReadOnly:
      data.packedDateReadOnly ?? defaultReadOnlySettings.packedDateReadOnly,
    shipmentCodeReadOnly:
      data.shipmentCodeReadOnly ?? defaultReadOnlySettings.shipmentCodeReadOnly,
  });

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/transactions');
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }
        const data = await response.json();
        setSettings(data);
        // setScrollToRows removed
        setReadOnlyColumns(extractReadOnlySettings(data));
      } catch (error) {
        logger.error('Error fetching transactions settings:', error);
        showNotification({
          title: '❌ Error',
          message: 'Failed to load transactions settings',
          color: 'red',
          autoClose: 4000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Save settings
  const handleSave = async () => {
    // scrollToRows validation removed

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // scrollToLastNonEmptyRows removed
          ...readOnlyColumns,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      setReadOnlyColumns(extractReadOnlySettings(updatedSettings));

      showNotification({
        title: '✅ Settings Saved',
        message:
          'Transactions page scroll behavior updated. Reload the transactions page to see changes.',
        color: 'green',
        autoClose: 5000,
      });
    } catch (error) {
      logger.error('Error saving transactions settings:', error);
      showNotification({
        title: '❌ Save Failed',
        message: 'Failed to save transactions settings',
        color: 'red',
        autoClose: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading settings...</Text>
      </Stack>
    );
  }

  const hasChanges = (() => {
    if (!settings) {
      return true;
    }

    const readOnlyChanged = Object.entries(readOnlyColumns).some(
      ([key, value]) =>
        value !== (settings[key as keyof ReadOnlySettings] ?? true)
    );

    return readOnlyChanged;
  })();

  const isSaveDisabled = isSaving || !hasChanges;
  const saveButtonStyles = {
    background: isSaveDisabled ? '#e5e7eb' : '#3b82f6',
    color: isSaveDisabled ? '#9ca3af' : '#ffffff',
    cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
    transition: 'background 150ms ease, color 150ms ease',
    '&:hover': isSaveDisabled
      ? undefined
      : {
          background: '#2563eb',
        },
  } as const;

  const readOnlyToggleMetadata: Array<{
    key: keyof ReadOnlySettings;
    label: string;
    description: string;
  }> = [
    {
      key: 'unitPriceReadOnly',
      label: 'Unit Price',
      description:
        'Lock the calculated unit price. Disable only if you need manual overrides.',
    },
    {
      key: 'lineTotalReadOnly',
      label: 'Line Total',
      description:
        'Line total is automatically calculated. Disable to override for exceptions.',
    },
    {
      key: 'invoiceDateReadOnly',
      label: 'Invoice Date',
      description: 'Toggle editing of the invoice date column.',
    },
    {
      key: 'packedDateReadOnly',
      label: 'Packed Date',
      description: 'Toggle editing of the packed date column.',
    },
    {
      key: 'shipmentCodeReadOnly',
      label: 'Shipment Code',
      description:
        'Automatically derived from product codes. Disable for manual overrides.',
    },
  ];

  const handleReadOnlyToggleChange = async (
    key: keyof ReadOnlySettings,
    nextValue: boolean
  ) => {
    if (!nextValue) {
      const toggleInfo = readOnlyToggleMetadata.find(
        (toggle) => toggle.key === key
      );
      const columnLabel = toggleInfo?.label ?? 'this column';

      const firstConfirm = await Swal.fire({
        title: `Disable ${columnLabel} protection?`,
        text: 'Unlocking allows manual edits that may disrupt calculations and data integrity.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, unlock it',
        cancelButtonText: 'Keep locked',
        reverseButtons: true,
        focusCancel: true,
      });

      if (!firstConfirm.isConfirmed) {
        return;
      }

      const secondConfirm = await Swal.fire({
        title: 'Final confirmation',
        text: `Are you absolutely sure you want to keep ${columnLabel.toLowerCase()} editable? Manual overrides should be rare.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, proceed',
        cancelButtonText: 'Go back',
        reverseButtons: true,
        focusCancel: true,
      });

      if (!secondConfirm.isConfirmed) {
        return;
      }
    }

    setReadOnlyColumns((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
  };

  return (
    <Stack gap="lg">
      <div>
        <Title
          order={3}
          style={{
            color: '#1e293b',
            fontWeight: 600,
          }}
        >
          Transactions Page Settings
        </Title>
        <Text size="sm" c="dimmed" mt="xs">
          Configure how the transactions page behaves when you open it
        </Text>
      </div>

      <Paper
        p="lg"
        withBorder
        radius="md"
        shadow="xs"
        styles={{
          root: {
            border: '1px solid #e2e8f0',
          },
        }}
      >
        <Stack gap="md">
          <Divider
            label="Read-Only Columns"
            styles={{
              label: {
                fontWeight: 600,
                color: '#1e293b',
              },
            }}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {readOnlyToggleMetadata.map((toggle) => (
              <Switch
                key={toggle.key}
                checked={readOnlyColumns[toggle.key]}
                onChange={(event) => {
                  const nextValue = event.currentTarget?.checked ?? true;
                  void handleReadOnlyToggleChange(toggle.key, nextValue);
                }}
                label={`${toggle.label} column is read-only`}
                description={toggle.description}
                size="md"
                styles={{
                  label: {
                    fontWeight: 600,
                    color: '#1e293b',
                  },
                }}
              />
            ))}
          </SimpleGrid>

          <Group justify="flex-end" mt="md">
            <Button
              leftSection={
                isSaving ? (
                  <Loader size={16} color="white" />
                ) : (
                  <IconDeviceFloppy size={16} />
                )
              }
              onClick={handleSave}
              disabled={isSaveDisabled}
              size="md"
              styles={{
                root: saveButtonStyles,
              }}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Group>

          {settings && (
            <Text size="xs" c="dimmed" ta="right">
              Last updated:{' '}
              {formatDateTime(settings.updatedAt, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
