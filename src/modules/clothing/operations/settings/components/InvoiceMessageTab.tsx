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
import { showNotification } from '@mantine/notifications';
import { IconInfoCircle, IconCheck, IconX } from '@tabler/icons-react';
import Swal from 'sweetalert2';
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
  const [originalValues, setOriginalValues] = useState({
    messageTemplate: '',
    paymentChannelsUrl: '',
  });

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
      
      // Store original values for comparison
      setOriginalValues({
        messageTemplate: settings.messageTemplate,
        paymentChannelsUrl: settings.paymentChannelsUrl,
      });
    } catch (error) {
      showNotification({
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

      showNotification({
        title: 'Success',
        message: 'Invoice message template saved successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Update original values after successful save
      setOriginalValues({
        messageTemplate: values.messageTemplate,
        paymentChannelsUrl: values.paymentChannelsUrl,
      });
    } catch (error) {
      showNotification({
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
    // First confirmation - Warning
    const firstConfirm = await Swal.fire({
      title: 'Reset to Default?',
      text: 'This will replace your current message template with the default template.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, continue',
      cancelButtonText: 'Cancel',
      focusCancel: true,
    });

    if (!firstConfirm.isConfirmed) {
      return;
    }

    // Second confirmation - Final warning
    const secondConfirm = await Swal.fire({
      title: 'Are you absolutely sure?',
      html: `
        <div style="text-align: left; margin-top: 1rem;">
          <p style="margin-bottom: 0.5rem;"><strong>This action will:</strong></p>
          <ul style="margin-left: 1.5rem; color: #ef4444;">
            <li>Delete your current message template</li>
            <li>Restore the original default message</li>
            <li>This cannot be undone</li>
          </ul>
        </div>
      `,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, reset it!',
      cancelButtonText: 'No, keep my template',
      focusCancel: true,
    });

    if (!secondConfirm.isConfirmed) {
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

      // Update original values after reset
      setOriginalValues({
        messageTemplate: settings.messageTemplate,
        paymentChannelsUrl: settings.paymentChannelsUrl,
      });

      await Swal.fire({
        title: 'Reset Complete!',
        text: 'Your message template has been reset to default.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        timer: 3000,
      });
    } catch (error) {
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to reset settings. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
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

  // Check if values have changed
  const hasChanges =
    form.values.messageTemplate !== originalValues.messageTemplate ||
    form.values.paymentChannelsUrl !== originalValues.paymentChannelsUrl;

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
              minRows={45}
              maxRows={68}
              autosize
              required
              styles={{
                input: {
                  fontSize: '14px',
                  lineHeight: '1.6',
                },
              }}
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
                  disabled={loading || !hasChanges}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  loading={loading}
                  disabled={!hasChanges}
                >
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
