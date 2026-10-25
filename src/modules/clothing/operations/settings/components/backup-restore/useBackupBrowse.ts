'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

export type BrowseTable = {
  key: string;
  schema: string;
  name: string;
  count: number | null;
  source: 'json' | 'csv' | 'dump';
};
export type BrowseCatalog = { strategy: string; tables: BrowseTable[] };
export type BrowsePage = {
  columns: string[];
  rows: Record<string, unknown>[];
  offset: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
  source: string;
};

async function fetchBrowse<T>(url: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) {
    controller.abort();
  }
  const timer = setTimeout(abort, 65000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load backup data.');
    }
    return payload as T;
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) {
      throw new Error('Preview timed out. Please retry.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export function useBackupBrowse(
  timestamp: string,
  table: string | null,
  offset: number,
  limit: number
) {
  const base = `/api/backup/${encodeURIComponent(timestamp)}/browse`;
  const catalog = useQuery({
    queryKey: ['backup-browse', timestamp],
    queryFn: ({ signal }) => fetchBrowse<BrowseCatalog>(base, signal),
    enabled: Boolean(timestamp),
    staleTime: Infinity,
    retry: false,
  });
  const rows = useQuery({
    queryKey: ['backup-rows', timestamp, table, offset, limit],
    queryFn: ({ signal }) =>
      fetchBrowse<BrowsePage>(
        `${base}/${encodeURIComponent(table ?? '')}?offset=${offset}&limit=${limit}`,
        signal
      ),
    enabled: Boolean(timestamp && table),
    staleTime: Infinity,
    retry: false,
    placeholderData: (previous, query) =>
      query?.queryKey[1] === timestamp && query.queryKey[2] === table
        ? keepPreviousData(previous)
        : undefined,
  });
  return { catalog, rows };
}
