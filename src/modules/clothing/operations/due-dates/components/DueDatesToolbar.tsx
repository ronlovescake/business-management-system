import { memo } from 'react';
import { Group } from '@mantine/core';
import { StandardTableControls } from '@/components/tables/StandardDataTable';
import type { DueDateStats } from '../types/dueDate.types';
import { DueDateStatsBadges } from './DueDateStatsBadges';

interface DueDatesToolbarProps {
  onSearch: (value: string) => void;
  stats: DueDateStats;
}

export const DueDatesToolbar = memo(
  ({ onSearch, stats }: DueDatesToolbarProps) => {
    return (
      <Group
        justify="space-between"
        align="center"
        wrap="nowrap"
        style={{ gap: '1rem' }}
      >
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <StandardTableControls
            searchPlaceholder="Search by customer or product code..."
            onSearch={onSearch}
            hideImport
            hideExport
            hideAddNew
            expandSearch
          />
        </div>
        <DueDateStatsBadges stats={stats} />
      </Group>
    );
  }
);

DueDatesToolbar.displayName = 'DueDatesToolbar';
