import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCustomerDetails } from '@/app/clothing/operations/customers/[id]/hooks/useCustomerDetails';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api }));
vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe('Customer rename query freshness', () => {
  it('refreshes nested customer histories, transaction lists, and analytics', async () => {
    let name = "Olie's Collection | Ces Obejas";
    api.get.mockImplementation(async (path: string) => {
      if (path.endsWith('/orders') || path.endsWith('/transactions')) {
        return [];
      }
      return { id: 123, 'Customer Name': name };
    });
    api.put.mockImplementation(
      async (_path: string, customer: { 'Customer Name': string }) => {
        name = customer['Customer Name'];
        return { id: 123, 'Customer Name': name };
      }
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['transactions', 'list', '/api'], []);
    queryClient.setQueryData(['analytics', 'customer-stats', '123'], {});
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result, unmount } = renderHook(() => useCustomerDetails('123'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setEditModalOpen(true);
      result.current.setEditForm({
        'Customer Name': "Olie's Collection | New Name",
      });
    });
    await act(async () => result.current.handleUpdateCustomer());
    await waitFor(() =>
      expect(result.current.customer?.['Customer Name']).toBe(
        "Olie's Collection | New Name"
      )
    );

    expect(invalidation).toHaveBeenCalledWith({
      queryKey: ['customers', 'detail', '123'],
    });
    expect(
      queryClient.getQueryState(['transactions', 'list', '/api'])?.isInvalidated
    ).toBe(true);
    expect(
      queryClient.getQueryState(['analytics', 'customer-stats', '123'])
        ?.isInvalidated
    ).toBe(true);
    unmount();
    queryClient.clear();
  });
});
