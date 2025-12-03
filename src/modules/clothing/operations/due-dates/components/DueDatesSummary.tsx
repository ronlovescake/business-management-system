import { memo } from 'react';
import { Text } from '@mantine/core';

interface DueDatesSummaryProps {
  filteredCount: number;
  totalCount: number;
}

export const DueDatesSummary = memo(
  ({ filteredCount, totalCount }: DueDatesSummaryProps) => (
    <Text size="sm" c="dimmed">
      Showing {filteredCount} of {totalCount} due dates
    </Text>
  )
);

DueDatesSummary.displayName = 'DueDatesSummary';
