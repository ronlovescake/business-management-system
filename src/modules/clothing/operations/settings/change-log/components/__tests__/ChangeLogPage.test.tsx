import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { ChangeLogPage } from '../ChangeLogPage';
import { useChangeLogQuery } from '../../hooks/useChangeLogQuery';

vi.mock('@/components/tables/StandardDataTable', () => ({
  StandardTableContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="standard-table-container">{children}</div>
  ),
}));

vi.mock('../../hooks/useChangeLogQuery', () => ({
  useChangeLogQuery: vi.fn(),
}));

const mockUseChangeLogQuery = vi.mocked(useChangeLogQuery);

function buildQueryResult(logs: Array<Record<string, unknown>> = []) {
  return {
    data: {
      logs,
      pagination: {
        page: 1,
        limit: 200,
        total: logs.length,
        pages: logs.length > 0 ? 1 : 0,
      },
      filters: null,
    },
    error: null,
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isInitialLoading: false,
    isLoading: false,
    isLoadingError: false,
    isPaused: false,
    isPending: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    refetch: vi.fn(),
    remove: vi.fn(),
  } as unknown as ReturnType<typeof useChangeLogQuery>;
}

function renderPage(
  props: Partial<React.ComponentProps<typeof ChangeLogPage>> = {}
) {
  return render(
    <MantineProvider>
      <ChangeLogPage {...props} />
    </MantineProvider>
  );
}

describe('ChangeLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChangeLogQuery.mockReturnValue(buildQueryResult());
  });

  it('passes embedded search and date filters to the query hook', () => {
    renderPage({
      hideFilters: true,
      externalSearch: 'INV-1041',
      externalStartDate: new Date(2026, 3, 4),
      externalEndDate: new Date(2026, 3, 5),
    });

    expect(mockUseChangeLogQuery).toHaveBeenCalled();

    const [params, options] = mockUseChangeLogQuery.mock.calls.at(-1) ?? [];

    expect(params).toBeDefined();

    expect(params).toMatchObject({
      page: 1,
      limit: 200,
      search: 'INV-1041',
      includeFilters: false,
    });
    expect(options).toEqual({ enabled: true });
    if (!params) {
      throw new Error('Expected query params to be passed to useChangeLogQuery');
    }

    const actualParams = params;

    expect(actualParams.startDate).toBeTruthy();
    expect(actualParams.endDate).toBeTruthy();

    const startDate = new Date(actualParams.startDate as string);
    const endDate = new Date(actualParams.endDate as string);

    expect(startDate.getFullYear()).toBe(2026);
    expect(startDate.getMonth()).toBe(3);
    expect(startDate.getDate()).toBe(4);
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);

    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(3);
    expect(endDate.getDate()).toBe(5);
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
  });

  it('uses generic headers for non-transaction entries', () => {
    mockUseChangeLogQuery.mockReturnValue(
      buildQueryResult([
        {
          id: 'log-1',
          createdAt: '2026-04-05T10:00:00.000Z',
          userId: 'user-1',
          userName: 'Ron',
          entityType: 'Setting',
          entityId: 'setting-1',
          action: 'update',
          field: 'backupPath',
          oldValue: '/old/path',
          newValue: '/new/path',
          source: 'settings',
          metadata: { scope: 'backup' },
        },
      ])
    );

    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'SYSTEM' }));
    fireEvent.click(screen.getByText('Setting · ID: setting-1'));

    expect(screen.getByText('SOURCE')).toBeInTheDocument();
    expect(screen.getByText('FIELD')).toBeInTheDocument();
    expect(screen.getByText('PREVIOUS VALUE')).toBeInTheDocument();
    expect(screen.getByText('NEW VALUE')).toBeInTheDocument();
    expect(screen.getByText('METADATA')).toBeInTheDocument();
    expect(screen.queryByText('ORDER DATE')).not.toBeInTheDocument();
  });
});