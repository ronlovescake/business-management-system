'use client';

/**
 * InvoiceSettingsTab Component
 *
 * Configure invoice generation settings
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Select,
  Title,
  Text,
  Card,
  Group,
  Button,
  Alert,
} from '@mantine/core';
import { IconDeviceFloppy, IconInfoCircle } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';

type InvoiceFormat = 'pdf' | 'png';

interface InvoiceSettings {
  format: InvoiceFormat;
  pngQuality: number;
}

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF Document' },
  { value: 'png', label: 'High-Definition PNG Image' },
];

const QUALITY_OPTIONS = [
  { value: '3', label: 'Standard HD (3x - 2451px × 3168px)' },
  { value: '4', label: 'High HD (4x - 3268px × 4224px)' },
  { value: '5', label: 'Very High HD (5x - 4085px × 5280px)' },
  { value: '6', label: 'Super HD (6x - 4902px × 6336px)' },
  { value: '8', label: 'Ultra HD (8x - 6536px × 8448px)' },
];

export function InvoiceSettingsTab() {
  const [settings, setSettings] = useState<InvoiceSettings>({
    format: 'png',
    pngQuality: 8,
  });
  const [originalSettings, setOriginalSettings] = useState<InvoiceSettings>({
    format: 'png',
    pngQuality: 8,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/invoice');
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setSettings(data.settings);
            setOriginalSettings(data.settings);
          }
        }
      } catch (error) {
        // Failed to load settings, use defaults
        void error;
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      showNotification({
        title: 'Settings Saved',
        message: 'Invoice generation settings have been updated successfully',
        color: 'green',
      });

      // Update original settings after successful save
      setOriginalSettings(settings);
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save invoice settings',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Stack gap="md">
        <Text c="dimmed">Loading settings...</Text>
      </Stack>
    );
  }

  // Check if settings have changed
  const hasChanges =
    settings.format !== originalSettings.format ||
    settings.pngQuality !== originalSettings.pngQuality;

  return (
    <Stack gap="lg">
      <div>
        <Title
          order={3}
          mb="xs"
          style={{
            color: '#1e293b',
            fontWeight: 600,
          }}
        >
          Invoice Generation Settings
        </Title>
        <Text size="sm" c="dimmed">
          Configure how invoices are generated and exported
        </Text>
      </div>

      <Alert
        icon={<IconInfoCircle size={16} />}
        color="blue"
        variant="light"
        styles={{
          root: {
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
          },
        }}
      >
        These settings apply to all invoice generation operations. Changes take
        effect immediately after saving.
      </Alert>

      <Card
        withBorder
        padding="lg"
        radius="md"
        shadow="xs"
        styles={{
          root: {
            border: '1px solid #e2e8f0',
          },
        }}
      >
        <Stack gap="md">
          <Select
            label="Invoice Output Format"
            description="Choose the file format for generated invoices"
            data={FORMAT_OPTIONS}
            value={settings.format}
            onChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                format: (value as InvoiceFormat) || 'pdf',
              }))
            }
            required
          />

          {settings.format === 'png' && (
            <Select
              label="PNG Image Quality"
              description="Higher quality produces larger files but better clarity. Ultra HD recommended for printing."
              data={QUALITY_OPTIONS}
              value={settings.pngQuality.toString()}
              onChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  pngQuality: parseInt(value || '8', 10),
                }))
              }
              required
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges || isSaving}
              size="md"
              styles={{
                root: {
                  background: '#3b82f6',
                  '&:hover': {
                    background: '#2563eb',
                  },
                  '&:disabled': {
                    background: '#e5e7eb',
                    color: '#9ca3af',
                  },
                },
              }}
            >
              Save Settings
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card
        withBorder
        padding="md"
        bg="gray.0"
        radius="md"
        styles={{
          root: {
            background: '#f8f9fa',
            border: '1px solid #e2e8f0',
          },
        }}
      >
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Format Comparison
          </Text>
          <Text size="xs" c="dimmed">
            <strong>PDF:</strong> Smaller file size, scalable, best for
            archiving and digital sharing
          </Text>
          <Text size="xs" c="dimmed">
            <strong>PNG:</strong> High resolution image, best for editing,
            social media, or when you need exact pixel control
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
