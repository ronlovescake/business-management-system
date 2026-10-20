import { Box, Group, Paper, Text } from '@mantine/core';

interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<TooltipEntry>;
  /** Formats a value by its series dataKey. */
  valueFormatter?: (value: number, dataKey: string) => string;
  /** Extra rows derived from the hovered datum (e.g. quantity for a sales bar). */
  extraRows?: (
    datum: Record<string, unknown>
  ) => Array<{ label: string; value: string }>;
}

export function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter,
  extraRows,
}: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload;

  return (
    <Paper
      px="sm"
      py={8}
      radius="md"
      withBorder
      style={{
        borderColor: 'var(--mantine-color-gray-2)',
        boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
        minWidth: 160,
      }}
    >
      {label !== undefined && label !== '' ? (
        <Text size="xs" fw={600} c="dark.6" mb={4}>
          {label}
        </Text>
      ) : null}
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? entry.name ?? '');
        const raw = Array.isArray(entry.value) ? entry.value[0] : entry.value;
        const numeric = typeof raw === 'number' ? raw : Number(raw);
        return (
          <Group key={key} justify="space-between" gap="md" wrap="nowrap">
            <Group gap={6} wrap="nowrap">
              <Box
                w={8}
                h={8}
                style={{ borderRadius: '50%', backgroundColor: entry.color }}
              />
              <Text size="xs" c="dimmed">
                {entry.name}
              </Text>
            </Group>
            <Text size="xs" fw={600} c="dark.7">
              {valueFormatter && Number.isFinite(numeric)
                ? valueFormatter(numeric, key)
                : String(raw ?? '')}
            </Text>
          </Group>
        );
      })}
      {datum && extraRows
        ? extraRows(datum).map((row) => (
            <Group
              key={row.label}
              justify="space-between"
              gap="md"
              wrap="nowrap"
            >
              <Text size="xs" c="dimmed" pl={14}>
                {row.label}
              </Text>
              <Text size="xs" fw={600} c="dark.7">
                {row.value}
              </Text>
            </Group>
          ))
        : null}
    </Paper>
  );
}
