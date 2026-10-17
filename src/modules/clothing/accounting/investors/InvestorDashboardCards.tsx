'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';

export function DashboardCard({
  title,
  description,
  action,
  accent,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <Paper
      component="section"
      aria-label={title}
      withBorder
      radius="lg"
      p="lg"
      shadow="xs"
      style={{
        minWidth: 0,
        borderLeft: accent
          ? `4px solid var(--mantine-color-${accent}-5)`
          : undefined,
      }}
    >
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="sm"
        mb="md"
      >
        <Box style={{ minWidth: 0 }}>
          <Title order={4} fz="md" fw={600}>
            {title}
          </Title>
          {description && (
            <Text size="xs" c="dimmed" mt={2}>
              {description}
            </Text>
          )}
        </Box>
        {action}
      </Group>
      {children}
    </Paper>
  );
}

export function DateBlock({
  value,
  tone,
  showYear = false,
}: {
  value: string;
  tone: string;
  showYear?: boolean;
}) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    <Stack
      gap={0}
      align="center"
      justify="center"
      w={48}
      h={showYear ? 54 : 48}
      aria-hidden
      style={{
        flexShrink: 0,
        borderRadius: 10,
        background: `var(--mantine-color-${tone}-0)`,
      }}
    >
      <Text fz={10} fw={700} c={`${tone}.7`} tt="uppercase" lh={1}>
        {parsed.toLocaleDateString('en-PH', {
          month: 'short',
          timeZone: 'UTC',
        })}
      </Text>
      <Text fw={700} fz="lg" lh={1.1}>
        {parsed.getUTCDate()}
      </Text>
      {showYear && (
        <Text fz={10} c="dimmed" lh={1}>
          {parsed.getUTCFullYear()}
        </Text>
      )}
    </Stack>
  );
}

export function DashboardRow({
  leading,
  title,
  subtitle,
  trailing,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Group wrap="nowrap" gap="sm" align="center">
      {leading}
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {title}
        </Text>
        {subtitle && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {subtitle}
          </Text>
        )}
      </Box>
      {trailing && (
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {trailing}
        </Group>
      )}
    </Group>
  );
}

export function DashboardList<T>({
  items,
  limit,
  getKey,
  renderItem,
  empty,
}: {
  items: T[];
  limit: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  empty: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="lg">
        {empty}
      </Text>
    );
  }
  const visible = expanded ? items : items.slice(0, limit);
  return (
    <Stack gap={0}>
      <Box style={{ maxHeight: expanded ? 440 : undefined, overflowY: 'auto' }}>
        {visible.map((item, index) => (
          <Box
            key={getKey(item)}
            py="sm"
            style={
              index
                ? { borderTop: '1px solid var(--mantine-color-gray-2)' }
                : undefined
            }
          >
            {renderItem(item)}
          </Box>
        ))}
      </Box>
      {items.length > limit && (
        <Button
          variant="subtle"
          size="compact-sm"
          mt="xs"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : `Show all ${items.length}`}
        </Button>
      )}
    </Stack>
  );
}
