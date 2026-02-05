import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createOptimisticUpdateHandlers } from '@/lib/react-query/optimistic';

describe('createOptimisticUpdateHandlers', () => {
  it('optimistically updates a single query key and returns previous data', async () => {
    const queryClient = new QueryClient();
    const queryKey = ['items'];

    queryClient.setQueryData(queryKey, [{ id: 1 }]);

    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    const handlers = createOptimisticUpdateHandlers<
      { id: number },
      { id: number }
    >({
      queryClient,
      queryKey,
      updater: (previous, nextItem) =>
        previous ? [...previous, nextItem] : previous,
    });

    const context = await handlers.onMutate({ id: 2 });

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey });
    expect(queryClient.getQueryData(queryKey)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(context.previousData).toEqual([{ id: 1 }]);
  });

  it('updates and rolls back multiple query keys', async () => {
    const queryClient = new QueryClient();
    const queryKeyA = ['items', 'a'];
    const queryKeyB = ['items', 'b'];

    queryClient.setQueryData(queryKeyA, [{ id: 1 }]);
    queryClient.setQueryData(queryKeyB, [{ id: 10 }]);

    const handlers = createOptimisticUpdateHandlers<
      { id: number; scope?: string },
      { id: number }
    >({
      queryClient,
      queryKey: [queryKeyA, queryKeyB],
      updater: (previous, variables, queryKey) => {
        const next = {
          id: variables.id,
          scope: queryKey === queryKeyA ? 'a' : 'b',
        };
        return previous ? [...previous, next] : previous;
      },
    });

    const context = await handlers.onMutate({ id: 2 });

    expect(queryClient.getQueryData(queryKeyA)).toEqual([
      { id: 1 },
      { id: 2, scope: 'a' },
    ]);
    expect(queryClient.getQueryData(queryKeyB)).toEqual([
      { id: 10 },
      { id: 2, scope: 'b' },
    ]);

    handlers.onError(new Error('fail'), { id: 2 }, context);

    expect(queryClient.getQueryData(queryKeyA)).toEqual([{ id: 1 }]);
    expect(queryClient.getQueryData(queryKeyB)).toEqual([{ id: 10 }]);
  });

  it('invalidates all query keys on settle', () => {
    const queryClient = new QueryClient();
    const queryKeyA = ['items', 'a'];
    const queryKeyB = ['items', 'b'];

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const handlers = createOptimisticUpdateHandlers<
      { id: number },
      { id: number }
    >({
      queryClient,
      queryKey: [queryKeyA, queryKeyB],
      updater: (previous) => previous,
    });

    handlers.onSettled();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeyA });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeyB });
  });
});
