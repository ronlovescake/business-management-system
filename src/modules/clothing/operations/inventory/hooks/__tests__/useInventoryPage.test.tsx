import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInventoryPage } from '../useInventoryPage';

describe('useInventoryPage split batch support', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips the split batch request when the API does not support it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useInventoryPage('/api/general-merchandise', {
        supportsSplitBatches: false,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      '/api/general-merchandise/split-batches'
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('requests split batches by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useInventoryPage('/api/clothing'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/clothing/split-batches'
    );
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('reuses a lost-response transfer key and generates a new key after a confirmed save', async () => {
    const savedKeys: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      savedKeys.push(new Headers(init.headers).get('Idempotency-Key')!);
      if (savedKeys.length === 1) {
        throw new TypeError('Response lost after commit');
      }
      return { ok: true, json: async () => ({ data: { id: 1 } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useInventoryPage());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const payload = {
      productCode: 'SOURCE',
      transferToProductCode: 'DEST',
      quantity: 1,
      fromBucket: 'sellable' as const,
      toBucket: 'supplier_short' as const,
      postingDate: '2026-10-28',
    };
    await act(async () => {
      await expect(result.current.createMovement(payload)).rejects.toThrow(
        'Response lost'
      );
    });
    await act(async () => {
      await result.current.createMovement(payload);
    });
    await act(async () => {
      await result.current.createMovement(payload);
    });
    expect(savedKeys).toHaveLength(3);
    expect(savedKeys[0]).toBe(savedKeys[1]);
    expect(savedKeys[2]).not.toBe(savedKeys[1]);
  });
});
