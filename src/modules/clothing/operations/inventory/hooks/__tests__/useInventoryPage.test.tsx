import { renderHook, waitFor } from '@testing-library/react';
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
});
