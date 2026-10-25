import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackupBrowsePanel } from '@/modules/clothing/operations/settings/components/backup-restore/BackupBrowsePanel';
import type { Backup } from '@/modules/clothing/operations/settings/backup/types';

const backup: Backup = {
  timestamp: 'first',
  files: ['full.dump'],
  path: '',
  totalSize: 10,
};
const catalog = {
  strategy: 'full',
  tables: [
    {
      key: 'public.customers',
      name: 'customers',
      schema: 'public',
      count: null,
      source: 'dump',
    },
  ],
};
const page = (name: string, offset = 0, hasMore = false) => ({
  columns: ['id', 'name'],
  rows: [{ id: 1, name }],
  offset,
  limit: 250,
  total: null,
  hasMore,
  source: 'dump',
});
const response = (payload: unknown) =>
  ({ ok: true, json: async () => payload }) as Response;
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal('React', React);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});
function tree(selected: Backup) {
  return (
    <MantineProvider>
      <QueryClientProvider client={client}>
        <BackupBrowsePanel key={selected.timestamp} backup={selected} />
      </QueryClientProvider>
    </MantineProvider>
  );
}

describe('backup table browsing', () => {
  it('loads dump-backed rows and requests the next server page', async () => {
    const fetcher = vi.fn(async (url: string) =>
      response(
        url.endsWith('/browse')
          ? catalog
          : page(
              url.includes('offset=250') ? 'Second page' : 'First page',
              url.includes('offset=250') ? 250 : 0,
              !url.includes('offset=250')
            )
      )
    );
    vi.stubGlobal('fetch', fetcher);
    render(tree(backup));
    expect(await screen.findByText('First page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Second page')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('offset=250&limit=250'),
      expect.anything()
    );
  });

  it('never shows a previous backup response after switching backups', async () => {
    let finish: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/browse')
          ? Promise.resolve(response(catalog))
          : url.includes('/first/')
            ? new Promise<Response>((resolve) => {
                finish = resolve;
              })
            : Promise.resolve(response(page('Current backup')))
      )
    );
    const rendered = render(tree(backup));
    await waitFor(() =>
      expect(client.isFetching({ queryKey: ['backup-rows', 'first'] })).toBe(1)
    );
    rendered.rerender(tree({ ...backup, timestamp: 'second' }));
    expect(await screen.findByText('Current backup')).toBeInTheDocument();
    finish(response(page('Stale backup')));
    await waitFor(() =>
      expect(screen.queryByText('Stale backup')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Current backup')).toBeInTheDocument();
  });

  it('keeps an error visible and retries the failed request', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/browse')
          ? response(catalog)
          : ++attempts === 1
            ? ({
                ok: false,
                json: async () => ({ error: 'Table unavailable' }),
              } as Response)
            : response(page('Recovered row'))
      )
    );
    render(tree(backup));
    expect(await screen.findByText('Table unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Recovered row')).toBeInTheDocument();
  });
});
