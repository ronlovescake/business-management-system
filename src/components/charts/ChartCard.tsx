import type { ReactNode } from 'react';
import { Group, Paper, Text } from '@mantine/core';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  actions,
  children,
}: ChartCardProps) {
  return (
    <Paper
      radius="md"
      p="lg"
      withBorder
      style={{
        borderColor: 'var(--mantine-color-gray-2)',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        height: '100%',
      }}
    >
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text fw={600} size="md" c="dark.7">
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          ) : null}
        </div>
        {actions}
      </Group>
      {children}
    </Paper>
  );
}
