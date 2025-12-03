import { memo } from 'react';
import { Badge, Group } from '@mantine/core';
import type { DueDateStats } from '../types/dueDate.types';

interface DueDateStatsBadgesProps {
  stats: DueDateStats;
}

export const DueDateStatsBadges = memo(({ stats }: DueDateStatsBadgesProps) => {
  return (
    <Group gap="xs" style={{ flexShrink: 0 }}>
      <Badge color="red" variant="light">
        {stats.overdue} Overdue
      </Badge>
      <Badge color="orange" variant="light">
        {stats.dueSoon} Due Soon
      </Badge>
      <Badge color="green" variant="light">
        {stats.onTrack} On Track
      </Badge>
    </Group>
  );
});

DueDateStatsBadges.displayName = 'DueDateStatsBadges';
