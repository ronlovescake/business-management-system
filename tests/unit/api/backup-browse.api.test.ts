import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as catalog } from '@/app/api/backup/[timestamp]/browse/route';
import { GET as rows } from '@/app/api/backup/[timestamp]/browse/[table]/route';
import { BrowseError } from '@/lib/backup/dumpPreview';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  catalog: vi.fn(),
  rows: vi.fn(),
}));
vi.mock('@/lib/auth/session', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/backup/browseBackup', () => ({
  getBrowseCatalog: mocks.catalog,
  getBrowseRows: mocks.rows,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ role: 'ADMIN' });
});

describe('backup browse API', () => {
  it.each([
    ['Unauthorized', 401],
    ['Forbidden', 403],
  ])('rejects %s before opening backup files', async (message, status) => {
    mocks.admin.mockRejectedValue(new Error(message as string));
    expect(
      (
        await catalog(new NextRequest('http://localhost/api'), {
          params: { timestamp: 'backup' },
        })
      ).status
    ).toBe(status);
    expect(
      (
        await rows(new NextRequest('http://localhost/api'), {
          params: { timestamp: 'backup', table: 'customers' },
        })
      ).status
    ).toBe(status);
    expect(mocks.catalog).not.toHaveBeenCalled();
    expect(mocks.rows).not.toHaveBeenCalled();
  });
  it('forwards cancellation and prevents caching', async () => {
    mocks.catalog.mockResolvedValue({ tables: [] });
    const request = new NextRequest('http://localhost/api');
    const response = await catalog(request, {
      params: { timestamp: 'backup' },
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.catalog).toHaveBeenCalledWith('backup', request.signal);
  });
  it.each(['offset=-1', 'offset=0.5', 'limit=9999', 'offset=Infinity'])(
    'rejects invalid paging: %s',
    async (query) => {
      expect(
        (
          await rows(new NextRequest(`http://localhost/api?${query}`), {
            params: { timestamp: 'backup', table: 'customers' },
          })
        ).status
      ).toBe(400);
      expect(mocks.rows).not.toHaveBeenCalled();
    }
  );
  it('returns busy status with Retry-After', async () => {
    mocks.catalog.mockRejectedValue(new BrowseError('Busy', 503));
    const response = await catalog(new NextRequest('http://localhost/api'), {
      params: { timestamp: 'backup' },
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('3');
  });
});
