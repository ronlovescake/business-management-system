'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconCopy, IconMessageDots } from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';

export interface MessageTemplate {
  title: string;
  badge: string;
  paragraphs: string[];
}

interface MessageTemplatesBoardProps {
  templates: MessageTemplate[];
}

export function MessageTemplatesBoard({
  templates,
}: MessageTemplatesBoardProps) {
  const clipboard = useClipboard({ timeout: 2000 });
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (!clipboard.copied) {
      setCopiedTemplate(null);
    }
  }, [clipboard.copied]);

  const handleCopy = (template: MessageTemplate) => {
    clipboard.copy(template.paragraphs.join('\n\n'));
    setCopiedTemplate(template.title);
  };

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
        {templates.map((template) => (
          <Paper key={template.title} withBorder radius="lg" p="xl">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                  <Group gap="xs" align="center">
                    <Title order={4} style={{ margin: 0 }}>
                      {template.title}
                    </Title>
                    <Badge
                      color={template.badge === 'Reminder' ? 'blue' : 'red'}
                      variant="light"
                    >
                      {template.badge}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Use as-is or tweak the wording to match your channel.
                  </Text>
                </Stack>
                <Tooltip
                  label={
                    copiedTemplate === template.title
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
                    color={copiedTemplate === template.title ? 'teal' : 'gray'}
                    onClick={() => handleCopy(template)}
                  >
                    {copiedTemplate === template.title ? (
                      <IconCheck size={18} />
                    ) : (
                      <IconCopy size={18} />
                    )}
                  </ActionIcon>
                </Tooltip>
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
    </Stack>
  );
}
