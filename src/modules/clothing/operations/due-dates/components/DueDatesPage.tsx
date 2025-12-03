'use client';

import { Stack } from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
} from '@/components/tables/StandardDataTable';
import { useDueDatesPage } from '../hooks/useDueDatesPage';
import { DueDatesToolbar } from './DueDatesToolbar';
import { DueDatesSummary } from './DueDatesSummary';
import { DueDatesTable } from './DueDatesTable';

export function DueDatesPage() {
  const {
    setSearchQuery,
    isLoading,
    stats,
    headers,
    filteredItems,
    totalItemCount,
    emptyStateMessage,
    getCustomerOrders,
    getFacebookLink,
  } = useDueDatesPage();

  if (isLoading) {
    return (
      <Stack gap="md">
        <DueDatesToolbar onSearch={setSearchQuery} stats={stats} />
        <StandardTableContainer>
          <StandardDataTable
            headers={headers}
            emptyState="Loading due dates..."
            colSpan={headers.length}
            height="86vh"
            withoutRowBorders
          >
            {[]}
          </StandardDataTable>
        </StandardTableContainer>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <DueDatesToolbar onSearch={setSearchQuery} stats={stats} />

      <StandardTableContainer
        summary={
          <DueDatesSummary
            filteredCount={filteredItems.length}
            totalCount={totalItemCount}
          />
        }
      >
        <DueDatesTable
          headers={headers}
          filteredItems={filteredItems}
          emptyState={emptyStateMessage}
          getCustomerOrders={getCustomerOrders}
          getFacebookLink={getFacebookLink}
        />
      </StandardTableContainer>
    </Stack>
  );
}
