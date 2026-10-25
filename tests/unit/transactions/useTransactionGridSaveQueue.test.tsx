import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTransactionGridSaveQueue } from '@/modules/clothing/operations/transactions/hooks/useTransactionGridSaveQueue';
import type { TransactionData } from '@/modules/clothing/operations/transactions/types/transaction.types';

const row = (id: number) =>
  ({ id, Notes: '', Quantity: 1, Customers: 'Customer' }) as TransactionData;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('transaction grid save queue', () => {
  it.each(['/api', '/api/general-merchandise'])(
    'serializes ten rapid edits and overlays stale reads in %s',
    async (scope) => {
      const first = deferred<TransactionData>();
      const transactions = Array.from({ length: 10 }, (_, index) =>
        row(index + 1)
      );
      const patch = vi
        .fn()
        .mockImplementation(async (id, data) => ({ ...row(id), ...data }))
        .mockReturnValueOnce(first.promise);
      const refresh = vi.fn().mockResolvedValue(transactions);
      const { result, rerender } = renderHook(() =>
        useTransactionGridSaveQueue({
          scope,
          transactions,
          patch,
          bulk: vi.fn(),
          refresh,
        })
      );
      let saves: Promise<TransactionData[]>[] = [];
      act(() => {
        saves = transactions.map(({ id }) =>
          result.current.enqueue([{ id: id!, data: { Notes: `edit-${id}` } }])
        );
      });
      expect(patch).toHaveBeenCalledTimes(1);
      rerender();
      expect(result.current.transactions.map((value) => value.Notes)).toEqual(
        transactions.map(({ id }) => `edit-${id}`)
      );
      await act(async () => {
        first.resolve({ ...row(1), Notes: 'edit-1' });
        await Promise.all(saves);
      });
      await waitFor(() => expect(result.current.hasPendingChanges).toBe(false));
      expect(patch).toHaveBeenCalledTimes(10);
      expect(refresh).toHaveBeenCalledTimes(1);
    }
  );

  it('coalesces unsent partials without mutating an active request or losing bulk fields', async () => {
    const first = deferred<TransactionData>();
    const patch = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockImplementation(async (id, data) => ({ ...row(id), ...data }));
    const bulk = vi.fn().mockResolvedValue({ count: 1 });
    const { result } = renderHook(() =>
      useTransactionGridSaveQueue({
        transactions: [row(1)],
        patch,
        bulk,
        refresh: vi.fn().mockResolvedValue([row(1)]),
      })
    );
    let saves: Promise<unknown>[] = [];
    act(() => {
      saves = [
        result.current.enqueue([{ id: 1, data: { Notes: 'first' } }]),
        result.current.enqueue([{ id: 1, data: { Notes: 'second' } }]),
        result.current.enqueue([
          { id: 1, data: { Customers: 'New customer' } },
        ]),
        result.current.enqueueBulk([{ id: 1, data: { Quantity: 5 } }]),
      ];
    });
    expect(result.current.getTransaction(1)).toMatchObject({
      Notes: 'second',
      Customers: 'New customer',
      Quantity: 5,
    });
    expect(patch.mock.calls[0][1]).toEqual({ Notes: 'first' });
    await act(async () => {
      first.resolve({ ...row(1), Notes: 'first' });
      await Promise.all(saves);
    });
    expect(patch).toHaveBeenCalledTimes(2);
    expect(bulk).toHaveBeenCalledWith([
      expect.objectContaining({
        Notes: 'second',
        Customers: 'New customer',
        Quantity: 5,
      }),
    ]);
  });

  it.each(['HTTP 400', 'HTTP 409', 'HTTP 500', 'timeout'])(
    'retains drafts on %s, pauses writes and refreshes before explicit retry',
    async (message) => {
      const patch = vi
        .fn()
        .mockRejectedValueOnce(new Error(message))
        .mockResolvedValue({ ...row(1), Notes: 'latest' });
      const refresh = vi.fn().mockResolvedValue([row(1)]);
      const { result } = renderHook(() =>
        useTransactionGridSaveQueue({
          transactions: [row(1)],
          patch,
          bulk: vi.fn(),
          refresh,
        })
      );
      await act(async () => {
        await result.current
          .enqueue([{ id: 1, data: { Notes: 'failed' } }])
          .catch(() => {});
      });
      expect(result.current.error).toBe(message);
      await act(async () => {
        await result.current
          .enqueue([{ id: 1, data: { Notes: 'latest' } }])
          .catch(() => {});
      });
      expect(patch).toHaveBeenCalledTimes(1);
      expect(result.current.transactions[0].Notes).toBe('latest');
      await act(async () => {
        await result.current.retry();
      });
      expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(
        patch.mock.invocationCallOrder[1]
      );
      expect(result.current.hasPendingChanges).toBe(false);
    }
  );

  it('does not replay acknowledged writes when reconciliation fails', async () => {
    const patch = vi.fn().mockResolvedValue({ ...row(1), Notes: 'saved' });
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValue([row(1)]);
    const { result } = renderHook(() =>
      useTransactionGridSaveQueue({
        transactions: [row(1)],
        patch,
        bulk: vi.fn(),
        refresh,
      })
    );
    await act(async () => {
      await result.current.enqueue([{ id: 1, data: { Notes: 'saved' } }]);
    });
    expect(result.current.error).toBe('read failed');
    await act(async () => {
      await result.current.retry();
    });
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('retains newer edits during reconciliation and performs another canonical read', async () => {
    const read = deferred<TransactionData[]>();
    const patch = vi
      .fn()
      .mockImplementation(async (id, data) => ({ ...row(id), ...data }));
    const refresh = vi
      .fn()
      .mockReturnValueOnce(read.promise)
      .mockResolvedValue([row(1)]);
    const { result } = renderHook(() =>
      useTransactionGridSaveQueue({
        transactions: [row(1)],
        patch,
        bulk: vi.fn(),
        refresh,
      })
    );
    await act(async () => {
      await result.current.enqueue([{ id: 1, data: { Notes: 'first' } }]);
    });
    let later!: Promise<TransactionData[]>;
    act(() => {
      later = result.current.enqueue([{ id: 1, data: { Notes: 'later' } }]);
    });
    expect(result.current.transactions[0].Notes).toBe('later');
    expect(patch).toHaveBeenCalledTimes(1);
    await act(async () => {
      read.resolve([row(1)]);
      await later;
    });
    expect(patch).toHaveBeenLastCalledWith(1, { Notes: 'later' });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('never recreates a deleted transaction on retry', async () => {
    const patch = vi.fn().mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() =>
      useTransactionGridSaveQueue({
        transactions: [row(1)],
        patch,
        bulk: vi.fn(),
        refresh: vi.fn().mockResolvedValue([]),
      })
    );
    await act(async () => {
      await result.current
        .enqueue([{ id: 1, data: { Notes: 'draft' } }])
        .catch(() => {});
    });
    await act(async () => {
      await result.current.retry();
    });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain('no longer exists');
    expect(result.current.transactions[0].Notes).toBe('draft');
    await act(async () => {
      await result.current.discard();
    });
    expect(result.current.hasPendingChanges).toBe(false);
  });

  it('keeps edits made during discard and does not replay the discarded revision', async () => {
    const read = deferred<TransactionData[]>();
    const patch = vi
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValue({ ...row(1), Notes: 'later' });
    const refresh = vi
      .fn()
      .mockReturnValueOnce(read.promise)
      .mockResolvedValue([row(1)]);
    const { result } = renderHook(() =>
      useTransactionGridSaveQueue({
        transactions: [row(1)],
        patch,
        bulk: vi.fn(),
        refresh,
      })
    );
    await act(async () => {
      await result.current
        .enqueue([{ id: 1, data: { Notes: 'discard me' } }])
        .catch(() => {});
    });
    let discard!: Promise<void>;
    act(() => {
      discard = result.current.discard();
    });
    await act(async () => {
      await result.current
        .enqueue([{ id: 1, data: { Notes: 'later' } }])
        .catch(() => {});
    });
    await act(async () => {
      read.resolve([row(1)]);
      await discard;
    });
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenLastCalledWith(1, { Notes: 'later' });
  });

  it('isolates late completions when the API scope changes', async () => {
    const old = deferred<TransactionData>();
    const patch = vi.fn().mockReturnValue(old.promise);
    const refresh = vi.fn().mockResolvedValue([row(1)]);
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useTransactionGridSaveQueue({
          scope,
          transactions: [row(1)],
          patch,
          bulk: vi.fn(),
          refresh,
        }),
      { initialProps: { scope: '/api' } }
    );
    let save!: Promise<unknown>;
    act(() => {
      save = result.current
        .enqueue([{ id: 1, data: { Notes: 'old domain' } }])
        .catch(() => {});
    });
    rerender({ scope: '/api/general-merchandise' });
    await act(async () => {
      old.resolve({ ...row(1), Notes: 'old domain' });
      await save;
    });
    expect(result.current.transactions[0].Notes).toBe('');
    expect(refresh).not.toHaveBeenCalled();
  });
});
