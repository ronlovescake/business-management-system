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
  Tabs,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconInfoCircle, IconCheck, IconX } from '@tabler/icons-react';
import Swal from 'sweetalert2';
import { MESSAGE_PLACEHOLDERS } from '../../checkout-links/utils/messageGenerator';
import { logger } from '@/lib/logger';
import { MessageTemplatesBoard } from '@/app/clothing/operations/message-templates/MessageTemplatesBoard';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/modules/clothing/operations/message-templates/templates.data';
import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';
import { PostTemplatesTab } from './PostTemplatesTab';

interface InvoiceSettings {
  id: string;
  messageTemplate: string;
  paymentChannelsUrl: string;
  createdAt: string;
  updatedAt: string;
}

type TemplateSubTab = 'invoice' | 'message-templates' | 'post-templates';

export default function InvoiceMessageTab() {
  const [loading, setLoading] = useState(false);
  const [fetchingSettings, setFetchingSettings] = useState(true);
  const [originalValues, setOriginalValues] = useState({
    messageTemplate: '',
    paymentChannelsUrl: '',
  });
  const [templateTab, setTemplateTab] = useState<TemplateSubTab>('invoice');
  const [editingEnabled, setEditingEnabled] = useState(false);
  const cloneTemplateList = (templates: MessageTemplate[]) =>
    templates.map((template) => ({
      ...template,
      paragraphs: [...template.paragraphs],
    }));

  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(
    () => cloneTemplateList(DEFAULT_MESSAGE_TEMPLATES)
  );
  const [loadingMessageTemplates, setLoadingMessageTemplates] = useState(true);

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
    fetchMessageTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMessageTemplates = async () => {
    try {
      setLoadingMessageTemplates(true);
      const response = await fetch('/api/message-templates');

      if (!response.ok) {
        throw new Error('Failed to load message templates');
      }

      const result = await response.json();
      const templates = Array.isArray(result.data)
        ? result.data
        : DEFAULT_MESSAGE_TEMPLATES;

      setMessageTemplates(cloneTemplateList(templates));
    } catch (error) {
      logger.error('Error fetching message templates', error);
      showNotification({
        title: 'Error',
        message: 'Failed to load message templates. Showing defaults.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      setMessageTemplates(cloneTemplateList(DEFAULT_MESSAGE_TEMPLATES));
    } finally {
      setLoadingMessageTemplates(false);
    }
  };

  const handleTemplateSave = async (
    template: MessageTemplate
  ): Promise<MessageTemplate> => {
    const response = await fetch('/api/message-templates', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to save template');
    }

    const result = await response.json();
    const savedTemplate = result.data as MessageTemplate;

    showNotification({
      title: 'Template saved',
      message: `${savedTemplate.title} updated successfully`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });

    return savedTemplate;
  };

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
      setEditingEnabled(false);
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
    if (!editingEnabled) {
      return;
    }
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
      setEditingEnabled(false);
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

  const handleEnableEditing = async () => {
    const confirmation = await Swal.fire({
      title: 'Edit invoice template?',
      text: 'You are about to enable editing. Any changes you save will update the shared template.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Enable editing',
      cancelButtonText: 'Cancel',
      focusCancel: true,
    });

    if (confirmation.isConfirmed) {
      setEditingEnabled(true);
    }
  };

  const handleCancelEditing = () => {
    if (!editingEnabled) {
      return;
    }
    setEditingEnabled(false);
    fetchSettings();
  };

  return (
    <Paper p="md">
      <Tabs
        value={templateTab}
        onChange={(value) =>
          setTemplateTab((value as TemplateSubTab) ?? 'invoice')
        }
      >
        <Tabs.List>
          <Tabs.Tab value="invoice">Invoice Message</Tabs.Tab>
          <Tabs.Tab value="message-templates">Message Templates</Tabs.Tab>
          <Tabs.Tab value="post-templates">Post Templates</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoice" pt="md">
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
                  <Code>{MESSAGE_PLACEHOLDERS.GREETING}</Code> - Time-based
                  greeting (Good Morning/Day/Afternoon/Evening)
                </List.Item>
                <List.Item>
                  <Code>{MESSAGE_PLACEHOLDERS.DRIVE_FILES}</Code> -
                  Customer&apos;s Google Drive invoice link (required)
                </List.Item>
                <List.Item>
                  <Code>{MESSAGE_PLACEHOLDERS.SHOPEE_LINK}</Code> - Shopee
                  checkout link based on weight (required)
                </List.Item>
                <List.Item>
                  <Code>{MESSAGE_PLACEHOLDERS.PAYMENT_CHANNELS_URL}</Code> -
                  Payment channels URL
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
                  readOnly={!editingEnabled}
                  styles={{
                    input: {
                      fontSize: '14px',
                      lineHeight: '1.6',
                      backgroundColor: !editingEnabled ? '#f8fafc' : undefined,
                    },
                  }}
                  {...form.getInputProps('messageTemplate')}
                />

                <TextInput
                  label="Payment Channels URL"
                  description="URL to your payment channels documentation"
                  placeholder="drive.google.com/..."
                  required
                  disabled={!editingEnabled}
                  {...form.getInputProps('paymentChannelsUrl')}
                />

                <Divider />

                <Group justify="space-between">
                  <Button
                    variant="outline"
                    color="red"
                    onClick={handleReset}
                    loading={loading}
                    disabled={!editingEnabled}
                  >
                    Reset to Default
                  </Button>

                  <Group>
                    <Button
                      variant="light"
                      onClick={handleEnableEditing}
                      disabled={editingEnabled}
                    >
                      Edit Template
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleCancelEditing}
                      disabled={!editingEnabled || loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      loading={loading}
                      disabled={!editingEnabled || !hasChanges}
                    >
                      Save Template
                    </Button>
                  </Group>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="message-templates" pt="md">
          <Stack gap="md">
            <div>
              <Title order={4}>Message Templates</Title>
              <Text size="sm" c="dimmed">
                Update the templates shown on the operations Message Templates
                page. Changes here apply immediately for everyone copying from
                that page.
              </Text>
            </div>

            {loadingMessageTemplates ? (
              <Paper withBorder p="md">
                <Text size="sm">Loading message templates...</Text>
              </Paper>
            ) : (
              <MessageTemplatesBoard
                templates={messageTemplates}
                allowEditing
                onTemplatesChange={setMessageTemplates}
                onTemplateSave={handleTemplateSave}
                showCopy={false}
              />
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="post-templates" pt="md">
          <PostTemplatesTab />
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}
