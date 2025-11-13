/**
 * Invoice Message Settings Tab
 * Allows configuration of invoice message template with placeholders
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Text,
  Textarea,
  TextInput,
  Button,
  Group,
  Stack,
  Alert,
  Divider,
  Code,
  List,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconCheck, IconX } from '@tabler/icons-react';
import { MESSAGE_PLACEHOLDERS } from '../../checkout-links/utils/messageGenerator';
import { logger } from '@/lib/logger';

interface InvoiceSettings {
  id: string;
  messageTemplate: string;
  paymentChannelsUrl: string;
  createdAt: string;
  updatedAt: string;
}

export default function InvoiceMessageTab() {
  const [loading, setLoading] = useState(false);
  const [fetchingSettings, setFetchingSettings] = useState(true);

  const form = useForm({
    initialValues: {
      messageTemplate: '',
      paymentChannelsUrl: '',
    },
    validate: {
      messageTemplate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Message template is required';
        }

        // Check for required placeholders
        if (!value.includes(MESSAGE_PLACEHOLDERS.DRIVE_FILES)) {
          return `Message template must include ${MESSAGE_PLACEHOLDERS.DRIVE_FILES} placeholder`;
        }

        if (!value.includes(MESSAGE_PLACEHOLDERS.SHOPEE_LINK)) {
          return `Message template must include ${MESSAGE_PLACEHOLDERS.SHOPEE_LINK} placeholder`;
        }

        return null;
      },
      paymentChannelsUrl: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Payment channels URL is required';
        }
        return null;
      },
    },
  });

  // Fetch current settings on mount
  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      setFetchingSettings(true);
      const response = await fetch('/api/invoice-settings');

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const result = await response.json();
      const settings: InvoiceSettings = result.data;

      form.setValues({
        messageTemplate: settings.messageTemplate,
        paymentChannelsUrl: settings.paymentChannelsUrl,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load invoice settings',
        color: 'red',
        icon: <IconX size={16} />,
      });
      logger.error('Error fetching invoice settings', error);
    } finally {
      setFetchingSettings(false);
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);

      const response = await fetch('/api/invoice-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      notifications.show({
        title: 'Success',
        message: 'Invoice message template saved successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to save settings',
        color: 'red',
        icon: <IconX size={16} />,
      });
      logger.error('Error saving invoice settings', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        'Are you sure you want to reset the message template to default?'
      )
    ) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/invoice-settings/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }

      const result = await response.json();
      const settings: InvoiceSettings = result.data;

      form.setValues({
        messageTemplate: settings.messageTemplate,
        paymentChannelsUrl: settings.paymentChannelsUrl,
      });

      notifications.show({
        title: 'Success',
        message: result.message || 'Settings reset to default',
        color: 'blue',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to reset settings',
        color: 'red',
        icon: <IconX size={16} />,
      });
      logger.error('Error resetting invoice settings', error);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingSettings) {
    return (
      <Paper p="md">
        <Text>Loading invoice message settings...</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Stack gap="md">
        <div>
          <Title order={3}>Invoice Message Template</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Configure the message template sent to customers with their
            invoices. Use placeholders to insert dynamic content.
          </Text>
        </div>

        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          <Text size="sm" fw={500} mb="xs">
            Available Placeholders:
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>
              <Code>{MESSAGE_PLACEHOLDERS.GREETING}</Code> - Time-based greeting
              (Good Morning/Day/Afternoon/Evening)
            </List.Item>
            <List.Item>
              <Code>{MESSAGE_PLACEHOLDERS.DRIVE_FILES}</Code> - Customer&apos;s
              Google Drive invoice link (required)
            </List.Item>
            <List.Item>
              <Code>{MESSAGE_PLACEHOLDERS.SHOPEE_LINK}</Code> - Shopee checkout
              link based on weight (required)
            </List.Item>
            <List.Item>
              <Code>{MESSAGE_PLACEHOLDERS.PAYMENT_CHANNELS_URL}</Code> - Payment
              channels URL
            </List.Item>
          </List>
        </Alert>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Textarea
              label="Message Template"
              description="Enter your invoice message template with placeholders"
              placeholder="Enter message template..."
              minRows={12}
              maxRows={20}
              required
              {...form.getInputProps('messageTemplate')}
            />

            <TextInput
              label="Payment Channels URL"
              description="URL to your payment channels documentation"
              placeholder="drive.google.com/..."
              required
              {...form.getInputProps('paymentChannelsUrl')}
            />

            <Divider />

            <Group justify="space-between">
              <Button
                variant="outline"
                color="red"
                onClick={handleReset}
                loading={loading}
              >
                Reset to Default
              </Button>

              <Group>
                <Button
                  variant="default"
                  onClick={() => fetchSettings()}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={loading}>
                  Save Template
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
