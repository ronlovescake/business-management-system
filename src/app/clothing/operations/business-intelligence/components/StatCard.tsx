import { memo } from 'react';
import { Card, Group, Text, Title, ThemeIcon } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: Icon;
  color: string;
}

export const StatCard = memo(function StatCard({
  title,
  value,
  icon: IconComponent,
  color,
}: StatCardProps) {
  return (
    <Card
      shadow="xs"
      padding="md"
      radius="md"
      withBorder
      style={{
        borderColor: '#6b7280',
        borderWidth: '1px',
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text c="gray.5" size="xs" fw={500}>
            {title}
          </Text>
          <Title order={3} style={{ color: '#374151' }} mt="xs">
            {value}
          </Title>
        </div>
        <ThemeIcon variant="light" color={color} size="lg" radius="md">
          <IconComponent size={24} />
        </ThemeIcon>
      </Group>
    </Card>
  );
});
