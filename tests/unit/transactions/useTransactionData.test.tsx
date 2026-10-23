import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTransactionData } from '@/hooks/useSheetData';
import type { TransactionDTO } from '@/types';

const transaction: TransactionDTO = {
  id: 51,
  'Order Date': '2026-10-19',
  Customers: 'Joseph Bautista | Aya Ole',
  'Product Code': 'PSO-101226',
  Quantity: 50,
  'Unit Price': 69,
  Discount: 0,
  Adjustment: 345,
  'Line Total': 3105,
  'Order Status': 'Prepared',
  Notes: '',
  'Invoice Date': '',
  'Packed Date': '',
  'Shipment Code': '',
};

function deferred<Value>() {
  const controls = {
    resolve: (_value: Value) => {},
    reject: (_error: Error) => {},
  };
  const promise = new Promise<Value>((resolve, reject) => {
    controls.resolve = resolve;
    controls.reject = reject;
  });
  return { promise, ...controls };
}

function setup() {
  const queryKey = ['transactions', 'list', '/api'];
  const otherQueryKey = ['transactions', 'list', '/api/general-merchandise'];
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const service = {
    getAll: vi.fn().mockResolvedValue([transaction]),
    update: vi.fn(),
    bulkUpdate: vi.fn(),
  };
  client.setQueryData(otherQueryKey, [
    { ...transaction, Customers: 'Other domain' },
  ]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useTransactionData({ service, queryKey }), {
    wrapper,
  });
  return { ...hook, client, service, queryKey, otherQueryKey };
}

afterEach(cleanup);

describe('confirmed transaction saves', () => {
  it('keeps a positive-balance A/R save after a fresh read without approval', async () => {
    const { result, service } = setup();
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const saved = { ...transaction, 'Order Status': 'Accounts Receivable' };
    service.update.mockResolvedValue(saved);
    service.getAll.mockResolvedValue([saved]);

    await act(async () => {
      await result.current.updateAsync({
        id: 51,
        data: { 'Order Status': 'Accounts Receivable' },
      });
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data[0]).toEqual(saved));
    expect(service.update).toHaveBeenCalledWith(51, {
      'Order Status': 'Accounts Receivable',
    });
    expect(service.getAll).toHaveBeenCalledTimes(2);
  });

  it('replaces optimistic A/R with canonical Shipped without changing another domain', async () => {
    const { result, service, client, otherQueryKey } = setup();
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const response = deferred<TransactionDTO>();
    service.update.mockReturnValue(response.promise);
    let save: Promise<TransactionDTO>;
    act(() => {
      save = result.current.updateAsync({
        id: 51,
        data: { 'Order Status': 'Accounts Receivable' },
      });
    });
    await waitFor(() =>
      expect(result.current.data[0]['Order Status']).toBe('Accounts Receivable')
    );
    const canonical = {
      ...transaction,
      Adjustment: 3450,
      'Line Total': 0,
      'Order Status': 'Shipped',
    };

    await act(async () => {
      response.resolve(canonical);
      await save;
    });

    await waitFor(() => expect(result.current.data[0]).toEqual(canonical));
    expect(client.getQueryData(otherQueryKey)).toEqual([
      { ...transaction, Customers: 'Other domain' },
    ]);
  });

  it('rejects and rolls back only the failed row, preserving unrelated edits', async () => {
    const { result, service, client, queryKey } = setup();
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const otherRow = { ...transaction, id: 52, Notes: 'Saved concurrently' };
    const response = deferred<TransactionDTO>();
    service.update.mockReturnValue(response.promise);
    let save: Promise<unknown>;
    act(() => {
      save = result.current
        .updateAsync({
          id: 51,
          data: { 'Order Status': 'Accounts Receivable' },
        })
        .catch((error) => error);
    });
    await waitFor(() =>
      expect(result.current.data[0]['Order Status']).toBe('Accounts Receivable')
    );
    const failure = new Error('Status save rejected');

    await act(async () => {
      client.setQueryData<TransactionDTO[]>(queryKey, (rows = []) => [
        ...rows,
        otherRow,
      ]);
      response.reject(failure);
      expect(await save).toBe(failure);
    });

    await waitFor(() =>
      expect(result.current.data).toEqual([transaction, otherRow])
    );
  });

  it('refreshes the saved batch before resolving with canonical server statuses', async () => {
    const { result, service, client, otherQueryKey } = setup();
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const canonical = {
      ...transaction,
      'Line Total': 0,
      'Order Status': 'Shipped',
    };
    service.bulkUpdate.mockResolvedValue({ count: 1 });
    service.getAll.mockResolvedValue([canonical]);

    await act(async () => {
      await result.current.bulkUpdateAsync([
        { ...canonical, 'Order Status': 'Accounts Receivable' },
      ]);
    });

    await waitFor(() => expect(result.current.data).toEqual([canonical]));
    expect(service.getAll).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(otherQueryKey)).toEqual([
      { ...transaction, Customers: 'Other domain' },
    ]);
  });

  it('rejects a failed batch and restores its previous statuses', async () => {
    const { result, service } = setup();
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    service.bulkUpdate.mockRejectedValue(new Error('Batch save rejected'));

    await act(async () => {
      await expect(
        result.current.bulkUpdateAsync([
          { ...transaction, 'Order Status': 'Accounts Receivable' },
        ])
      ).rejects.toThrow('Batch save rejected');
    });

    await waitFor(() => expect(result.current.data).toEqual([transaction]));
  });
});
