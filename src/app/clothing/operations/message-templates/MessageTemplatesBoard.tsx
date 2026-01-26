'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Badge,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconCopy,
  IconMessageDots,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';
import { MESSAGE_TEMPLATE_TITLE_ORDER } from '@/modules/clothing/operations/message-templates/templates.data';
import { logger } from '@/lib/logger';
import Swal from 'sweetalert2';

interface MessageTemplatesBoardProps {
  templates: MessageTemplate[];
  allowEditing?: boolean;
  onTemplatesChange?: (templates: MessageTemplate[]) => void;
  showCopy?: boolean;
  showHeader?: boolean;
  showUsageHint?: boolean;
  onTemplateSave?: (
    template: MessageTemplate
  ) => Promise<MessageTemplate | void>;
  onTemplateCreate?: (
    template: Omit<MessageTemplate, 'id'>
  ) => Promise<MessageTemplate>;
  addTemplateCtaHref?: string;
  addTemplateCtaLabel?: string;
}

export function MessageTemplatesBoard({
  templates,
  allowEditing = false,
  onTemplatesChange,
  showCopy = true,
  showHeader = true,
  showUsageHint = true,
  onTemplateSave,
  onTemplateCreate,
  addTemplateCtaHref,
  addTemplateCtaLabel = 'Add New Template',
}: MessageTemplatesBoardProps) {
  const clipboard = useClipboard({ timeout: 2000 });
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const cloneTemplates = (items: MessageTemplate[]) =>
    items.map((template) => ({
      ...template,
      paragraphs: [...template.paragraphs],
    }));
  const parseBodyToParagraphs = (body: string) =>
    body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

  const templateOrderLookup = useMemo(
    () =>
      new Map<string, number>(
        MESSAGE_TEMPLATE_TITLE_ORDER.map((title, index) => [
          title.toLowerCase(),
          index,
        ])
      ),
    []
  );

  const sortTemplatesByOrder = useCallback(
    (templatesToSort: MessageTemplate[]) => {
      if (templateOrderLookup.size === 0) {
        return [...templatesToSort];
      }

      return [...templatesToSort].sort((a, b) => {
        const aOrder = templateOrderLookup.get(a.title.toLowerCase());
        const bOrder = templateOrderLookup.get(b.title.toLowerCase());

        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }

        if (aOrder !== undefined) {
          return -1;
        }

        if (bOrder !== undefined) {
          return 1;
        }

        return a.title.localeCompare(b.title);
      });
    },
    [templateOrderLookup]
  );

  const [templateList, setTemplateList] = useState<MessageTemplate[]>(() =>
    sortTemplatesByOrder(cloneTemplates(templates))
  );
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [editValues, setEditValues] = useState({
    title: '',
    badge: '',
    body: '',
  });
  const [editingSnapshot, setEditingSnapshot] = useState({
    title: '',
    badge: '',
    body: '',
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createValues, setCreateValues] = useState({
    title: '',
    badge: '',
    body: '',
  });
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const editingEnabled = allowEditing;

  useEffect(() => {
    if (!clipboard.copied) {
      setCopiedTemplateId(null);
    }
  }, [clipboard.copied]);

  useEffect(() => {
    setTemplateList(sortTemplatesByOrder(cloneTemplates(templates)));
  }, [templates, sortTemplatesByOrder]);

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        logger.warn('Clipboard writeText failed, using fallback', error);
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  };

  const handleCopy = async (template: MessageTemplate) => {
    const payload = template.paragraphs.join('\n\n');
    const copied = await copyTextToClipboard(payload);

    if (copied) {
      clipboard.copy(payload);
      setCopiedTemplateId(template.id);
      return;
    }

    await Swal.fire({
      title: 'Copy failed',
      text: 'Unable to copy to clipboard. Please try again or copy manually.',
      icon: 'error',
      confirmButtonColor: '#ef4444',
    });
  };

  const openEditor = async (template: MessageTemplate) => {
    if (!editingEnabled) {
      return;
    }

    const confirmation = await Swal.fire({
      title: `Edit ${template.title} template?`,
      html: `
        <div style="text-align: left;">
          <p style="margin-bottom: 0.5rem;">
            You are about to edit the <strong>${template.title}</strong> template.
          </p>
          <p style="margin-top: 0.75rem; color: #ef4444;">
            Any changes you save will be visible to everyone.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Continue editing',
      cancelButtonText: 'Cancel',
      focusCancel: true,
      customClass: {
        popup: 'template-edit-warning',
      },
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setEditingTemplateId(template.id);
    setEditValues({
      title: template.title,
      badge: template.badge,
      body: template.paragraphs.join('\n\n'),
    });
    setEditingSnapshot({
      title: template.title,
      badge: template.badge,
      body: template.paragraphs.join('\n\n'),
    });
  };

  const closeEditor = () => {
    setEditingTemplateId(null);
    setEditingSnapshot({ title: '', badge: '', body: '' });
  };

  const resetCreateForm = () => {
    setCreateValues({ title: '', badge: '', body: '' });
  };

  const handleCreateTemplate = async () => {
    if (!onTemplateCreate) {
      return;
    }

    const title = createValues.title.trim();
    const badge = createValues.badge.trim();
    const paragraphs = parseBodyToParagraphs(createValues.body);

    if (!title) {
      await Swal.fire({
        title: 'Title required',
        text: 'Please provide a template title.',
        icon: 'warning',
        confirmButtonColor: '#2563eb',
      });
      return;
    }

    if (!badge) {
      await Swal.fire({
        title: 'Badge required',
        text: 'Please provide a badge label.',
        icon: 'warning',
        confirmButtonColor: '#2563eb',
      });
      return;
    }

    if (paragraphs.length === 0) {
      await Swal.fire({
        title: 'Content required',
        text: 'Add at least one paragraph to the template.',
        icon: 'warning',
        confirmButtonColor: '#2563eb',
      });
      return;
    }

    try {
      setCreatingTemplate(true);
      const persistedTemplate = await onTemplateCreate({
        title,
        badge,
        paragraphs,
      });

      const normalizedTemplate: MessageTemplate = {
        ...persistedTemplate,
        paragraphs: [...persistedTemplate.paragraphs],
      };

      setTemplateList((prev) => {
        const updated = [...prev, normalizedTemplate];
        const sorted = sortTemplatesByOrder(updated);
        onTemplatesChange?.(sorted);
        return sorted;
      });

      resetCreateForm();
      setCreateModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create template. Please try again.';
      await Swal.fire({
        title: 'Create failed',
        text: message,
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleSave = async () => {
    if (editingTemplateId === null) {
      return;
    }

    const hasChanges =
      editValues.title.trim() !== editingSnapshot.title.trim() ||
      editValues.badge.trim() !== editingSnapshot.badge.trim() ||
      editValues.body.trim() !== editingSnapshot.body.trim();

    if (!hasChanges) {
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Save template edits?',
      text: 'These changes update the shared template for everyone copying it.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, save',
      cancelButtonText: 'Cancel',
      focusCancel: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const paragraphs = parseBodyToParagraphs(editValues.body);
    const fallbackParagraphs = parseBodyToParagraphs(editingSnapshot.body);

    const pendingTemplate: MessageTemplate = {
      id: editingTemplateId,
      title: editValues.title.trim(),
      badge: editValues.badge.trim() || editingSnapshot.badge,
      paragraphs: paragraphs.length > 0 ? paragraphs : fallbackParagraphs,
    };

    if (pendingTemplate.paragraphs.length === 0) {
      await Swal.fire({
        title: 'Cannot save template',
        text: 'Template must include at least one paragraph.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
      return;
    }

    try {
      setSavingTemplate(true);
      const persistedTemplate =
        (await onTemplateSave?.(pendingTemplate)) ?? pendingTemplate;
      const normalizedTemplate: MessageTemplate = {
        ...persistedTemplate,
        paragraphs: [...persistedTemplate.paragraphs],
      };

      setTemplateList((prev) => {
        const updatedList = prev.map((template) =>
          template.id === editingTemplateId ? normalizedTemplate : template
        );
        const sortedList = sortTemplatesByOrder(updatedList);

        onTemplatesChange?.(sortedList);
        return sortedList;
      });

      closeEditor();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save template. Please try again.';
      await Swal.fire({
        title: 'Save failed',
        text: message,
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const badgeOptions = useMemo(() => {
    const defaults = ['Reminder', 'Cancellation'];
    const unique = new Set([...defaults, ...templateList.map((t) => t.badge)]);
    return Array.from(unique);
  }, [templateList]);

  const hasTemplateChanges =
    editingTemplateId !== null &&
    (editValues.title.trim() !== editingSnapshot.title.trim() ||
      editValues.badge.trim() !== editingSnapshot.badge.trim() ||
      editValues.body.trim() !== editingSnapshot.body.trim());

  return (
    <Stack gap="xl">
      {showHeader && (
        <Paper
          withBorder
          radius="lg"
          p="xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,249,250,0.8))',
          }}
        >
          <Stack gap="sm" align="center">
            <IconMessageDots size={42} stroke={1.2} color="#4dabf7" />
            <Title order={3}>Ready-to-send templates</Title>
            <Text size="sm" c="dimmed" ta="center" maw={520}>
              Copy any message below and personalize it before sending. These
              drafts keep tone and timing consistent for every customer
              touchpoint.
            </Text>
          </Stack>
        </Paper>
      )}

      {((editingEnabled && onTemplateCreate) || addTemplateCtaHref) && (
        <Group justify="flex-end">
          {editingEnabled && onTemplateCreate ? (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Add New Template
            </Button>
          ) : (
            addTemplateCtaHref && (
              <Button
                component={Link}
                href={addTemplateCtaHref}
                leftSection={<IconPlus size={16} />}
              >
                {addTemplateCtaLabel}
              </Button>
            )
          )}
        </Group>
      )}

      <Stack gap="lg">
        {templateList.map((template) => (
          <Paper key={template.id} withBorder radius="lg" p="xl">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                  <Group gap="xs" align="center">
                    <Title order={4} style={{ margin: 0 }}>
                      {template.title}
                    </Title>
                    <Badge
                      color={
                        template.badge.toLowerCase() === 'reminder'
                          ? 'blue'
                          : template.badge.toLowerCase() === 'cancellation'
                            ? 'red'
                            : 'gray'
                      }
                      variant="light"
                    >
                      {template.badge}
                    </Badge>
                  </Group>
                  {showUsageHint && (
                    <Text size="sm" c="dimmed">
                      Use as-is or tweak the wording to match your channel.
                    </Text>
                  )}
                </Stack>
                <Group gap="xs">
                  {editingEnabled && (
                    <Tooltip label="Edit template" withArrow fz="xs">
                      <ActionIcon
                        aria-label="Edit message template"
                        variant="subtle"
                        radius="xl"
                        color="blue"
                        onClick={() => openEditor(template)}
                      >
                        <IconPencil size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {showCopy && (
                    <Tooltip
                      label={
                        copiedTemplateId === template.id
                          ? 'Copied!'
                          : 'Copy message'
                      }
                      withArrow
                      fz="xs"
                    >
                      <ActionIcon
                        aria-label="Copy message template"
                        variant="subtle"
                        radius="xl"
                        color={
                          copiedTemplateId === template.id ? 'teal' : 'gray'
                        }
                        onClick={() => handleCopy(template)}
                      >
                        {copiedTemplateId === template.id ? (
                          <IconCheck size={18} />
                        ) : (
                          <IconCopy size={18} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>

              <Stack gap={8}>
                {template.paragraphs.map((paragraph) => (
                  <Text size="sm" key={`${template.title}-${paragraph}`}>
                    {paragraph}
                  </Text>
                ))}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {editingEnabled && (
        <>
          <Modal
            opened={createModalOpen}
            onClose={() => {
              setCreateModalOpen(false);
              resetCreateForm();
            }}
            title="Add New Template"
            size="lg"
            radius="md"
            centered
          >
            <Stack gap="md">
              <TextInput
                label="Template title"
                value={createValues.title}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setCreateValues((prev) => ({ ...prev, title: value }));
                }}
                withAsterisk
              />
              <TextInput
                label="Badge label"
                description={`Suggestions: ${badgeOptions.join(', ')}`}
                value={createValues.badge}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setCreateValues((prev) => ({ ...prev, badge: value }));
                }}
                withAsterisk
              />
              <Textarea
                label="Message body"
                description="Separate paragraphs with a blank line"
                minRows={12}
                autosize
                value={createValues.body}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setCreateValues((prev) => ({ ...prev, body: value }));
                }}
              />

              <Group justify="flex-end" gap="sm">
                <Button
                  variant="default"
                  onClick={() => {
                    setCreateModalOpen(false);
                    resetCreateForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTemplate}
                  loading={creatingTemplate}
                >
                  Create Template
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={editingTemplateId !== null}
            onClose={closeEditor}
            title="Edit Template"
            size="lg"
            radius="md"
            centered
          >
            <Stack gap="md">
              <TextInput
                label="Template title"
                value={editValues.title}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setEditValues((prev) => ({ ...prev, title: value }));
                }}
                withAsterisk
              />
              <TextInput
                label="Badge label"
                description={`Suggestions: ${badgeOptions.join(', ')}`}
                value={editValues.badge}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setEditValues((prev) => ({ ...prev, badge: value }));
                }}
                withAsterisk
              />
              <Textarea
                label="Message body"
                description="Separate paragraphs with a blank line"
                minRows={12}
                autosize
                value={editValues.body}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setEditValues((prev) => ({ ...prev, body: value }));
                }}
              />

              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!hasTemplateChanges || savingTemplate}
                  loading={savingTemplate}
                >
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </Modal>
        </>
      )}
    </Stack>
  );
}

export type { MessageTemplatesBoardProps };
