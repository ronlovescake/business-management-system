'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';

interface MessageTemplatesBoardProps {
  templates: MessageTemplate[];
  allowEditing?: boolean;
  onTemplatesChange?: (templates: MessageTemplate[]) => void;
}

export function MessageTemplatesBoard({
  templates,
  allowEditing = false,
  onTemplatesChange,
}: MessageTemplatesBoardProps) {
  const clipboard = useClipboard({ timeout: 2000 });
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const cloneTemplates = (items: MessageTemplate[]) =>
    items.map((template) => ({
      ...template,
      paragraphs: [...template.paragraphs],
    }));

  const [templateList, setTemplateList] = useState<MessageTemplate[]>(() =>
    cloneTemplates(templates)
  );
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [editValues, setEditValues] = useState({
    title: '',
    badge: '',
    body: '',
  });
  const editingEnabled = allowEditing;

  useEffect(() => {
    if (!clipboard.copied) {
      setCopiedTemplateId(null);
    }
  }, [clipboard.copied]);

  useEffect(() => {
    setTemplateList(cloneTemplates(templates));
  }, [templates]);

  const handleCopy = (template: MessageTemplate) => {
    clipboard.copy(template.paragraphs.join('\n\n'));
    setCopiedTemplateId(template.id);
  };

  const openEditor = (template: MessageTemplate) => {
    if (!editingEnabled) {
      return;
    }
    setEditingTemplateId(template.id);
    setEditValues({
      title: template.title,
      badge: template.badge,
      body: template.paragraphs.join('\n\n'),
    });
  };

  const closeEditor = () => {
    setEditingTemplateId(null);
  };

  const handleSave = () => {
    if (editingTemplateId === null) {
      return;
    }

    const paragraphs = editValues.body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    setTemplateList((prev) => {
      const updatedList = prev.map((template) =>
        template.id === editingTemplateId
          ? {
              id: template.id,
              title: editValues.title.trim(),
              badge: editValues.badge.trim() || template.badge,
              paragraphs: paragraphs.length ? paragraphs : template.paragraphs,
            }
          : template
      );

      onTemplatesChange?.(updatedList);
      return updatedList;
    });

    closeEditor();
  };

  const badgeOptions = useMemo(() => {
    const defaults = ['Reminder', 'Cancellation'];
    const unique = new Set([...defaults, ...templateList.map((t) => t.badge)]);
    return Array.from(unique);
  }, [templateList]);

  return (
    <Stack gap="xl">
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
                  <Text size="sm" c="dimmed">
                    Use as-is or tweak the wording to match your channel.
                  </Text>
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
                      color={copiedTemplateId === template.id ? 'teal' : 'gray'}
                      onClick={() => handleCopy(template)}
                    >
                      {copiedTemplateId === template.id ? (
                        <IconCheck size={18} />
                      ) : (
                        <IconCopy size={18} />
                      )}
                    </ActionIcon>
                  </Tooltip>
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
        <Modal
          opened={editingTemplateId !== null}
          onClose={closeEditor}
          title="Edit Template"
          size="lg"
          radius="md"
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
              <Button onClick={handleSave}>Save Changes</Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </Stack>
  );
}
