import { memo } from 'react';
import { Badge, Group, Paper, Text } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';

interface KpiCardProps {
  label: string;
  value: string;
  badge?: string;
  /** Percent change vs the comparison period; null/undefined hides it. */
  delta?: number | null;
  deltaCaption?: string;
  caption?: string;
}

export const KpiCard = memo(function KpiCard({
  label,
  value,
  badge,
  delta,
  deltaCaption = 'vs previous period',
  caption,
}: KpiCardProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const isUp = hasDelta && delta >= 0;
  const DeltaIcon = isUp ? IconArrowUpRight : IconArrowDownRight;

  return (
    <Paper
      radius="md"
      p="md"
      withBorder
      style={{
        borderColor: 'var(--mantine-color-gray-2)',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
        <Text
          size="xs"
          c="dimmed"
          tt="uppercase"
          fw={500}
          style={{ letterSpacing: '0.3px' }}
          truncate
        >
          {label}
        </Text>
        {badge ? (
          <Badge size="xs" radius="sm" variant="filled" color="indigo">
            {badge}
          </Badge>
        ) : null}
      </Group>
      <Group gap={8} align="baseline" mt={10} wrap="nowrap">
        <Text fw={600} c="dark.7" style={{ fontSize: 22, lineHeight: 1.2 }}>
          {value}
        </Text>
        {hasDelta ? (
          <Group gap={2} wrap="nowrap">
            <Text size="xs" fw={500} c={isUp ? 'teal.6' : 'red.6'}>
              {`${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
            </Text>
            <DeltaIcon
              size={14}
              color={`var(--mantine-color-${isUp ? 'teal' : 'red'}-6)`}
            />
          </Group>
        ) : null}
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        {hasDelta ? deltaCaption : (caption ?? '\u00a0')}
      </Text>
    </Paper>
  );
});
