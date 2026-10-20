import { Box, Group, Text } from '@mantine/core';

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box
        w={8}
        h={8}
        style={{ borderRadius: '50%', backgroundColor: color }}
      />
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}
