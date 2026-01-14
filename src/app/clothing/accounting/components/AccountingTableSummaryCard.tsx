import type { ReactNode } from 'react';
import { memo } from 'react';
import { Card, Group, Text } from '@mantine/core';

export type AccountingSummaryItem = {
  label: string;
  value: ReactNode;
};

interface AccountingTableSummaryCardProps {
  leftText: ReactNode;
  items: AccountingSummaryItem[];
}

export const AccountingTableSummaryCard = memo(
  function AccountingTableSummaryCard({
    leftText,
    items,
  }: AccountingTableSummaryCardProps) {
    return (
      <Card withBorder padding="md">
        <Group justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed">
            {leftText}
          </Text>
          {items.length === 1 ? (
            <Text size="sm" fw={600}>
              {items[0].label} {items[0].value}
            </Text>
          ) : (
            <Group gap="lg">
              {items.map((item) => (
                <Text key={item.label} size="sm" fw={600}>
                  {item.label} {item.value}
                </Text>
              ))}
            </Group>
          )}
        </Group>
      </Card>
    );
  }
);
