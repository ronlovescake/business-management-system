/**
 * Modules — Config API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/module-marketplace-and-module-operations.md:
 *   #4  — Config stored in installedModule table
 *   #5  — Config writes are upserts keyed by moduleId
 *   #6  — Required config fields: id, name, version
 *   #7  — IDs/names/versions sanitized before persistence
 *   #8  — GET returns all installed modules ordered by installedAt desc
 *   #9  — Config list fails open to [] on missing-table error (Prisma P2021)
 *   #10 — Per-module lookup returns 404 for unknown ID
 *   #11 — Per-module delete is a hard removal
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- hoisted mocks ----

const { mockPrisma } = vi.hoisted(() => {
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const upsert = vi.fn();
  const deleteFn = vi.fn();

  return {
    mockPrisma: {
      installedModule: {
        findMany,
        findUnique,
        upsert,
        delete: deleteFn,
      },
    },
  };
});

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: { name: (v: string) => v.trim() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Import route handlers ----

describe('Modules — Config API (Business Rules)', () => {
  // -----------------------------------------------------------------------
  // Rule #8: GET returns all installed modules ordered by installedAt desc
  // -----------------------------------------------------------------------

  describe('Rule #8: GET returns installed modules ordered by installedAt desc', () => {
    it('returns modules from prisma ordered by installedAt desc', async () => {
      const modules = [
        {
          id: '2',
          moduleId: 'mod-b',
          name: 'Module B',
          enabled: true,
          config: { id: 'mod-b', name: 'Module B', version: '2.0.0', enabled: true },
          installedAt: new Date('2026-04-08'),
        },
        {
          id: '1',
          moduleId: 'mod-a',
          name: 'Module A',
          enabled: true,
          config: { id: 'mod-a', name: 'Module A', version: '1.0.0', enabled: true },
          installedAt: new Date('2026-04-07'),
        },
      ];

      mockPrisma.installedModule.findMany.mockResolvedValue(modules);

      const { GET } = await import('@/app/api/modules/config/route');
      const res = await GET();
      const json = await res.json();

      expect(mockPrisma.installedModule.findMany).toHaveBeenCalledWith({
        orderBy: { installedAt: 'desc' },
      });
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Rule #9: Config list fails open to [] on missing-table error (P2021)
  // -----------------------------------------------------------------------

  describe('Rule #9: GET fails open to [] on P2021 table-missing error', () => {
    it('returns empty array when Prisma P2021 error occurs', async () => {
      const error = new Error('Table not found');
      (error as unknown as { code: string }).code = 'P2021';
      mockPrisma.installedModule.findMany.mockRejectedValue(error);

      const { GET } = await import('@/app/api/modules/config/route');
      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual([]);
    });

    it('returns 500 for non-P2021 errors', async () => {
      mockPrisma.installedModule.findMany.mockRejectedValue(
        new Error('Connection refused')
      );

      const { GET } = await import('@/app/api/modules/config/route');
      const res = await GET();

      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // Rule #6: Required config fields: id, name, version
  // -----------------------------------------------------------------------

  describe('Rule #6: POST requires id, name, version', () => {
    it('rejects when id is missing', async () => {
      const { POST } = await import('@/app/api/modules/config/route');
      const req = new NextRequest('http://localhost/api/modules/config', {
        method: 'POST',
        body: JSON.stringify({ name: 'Mod', version: '1.0.0' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects when name is missing', async () => {
      const { POST } = await import('@/app/api/modules/config/route');
      const req = new NextRequest('http://localhost/api/modules/config', {
        method: 'POST',
        body: JSON.stringify({ id: 'x', version: '1.0.0' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects when version is missing', async () => {
      const { POST } = await import('@/app/api/modules/config/route');
      const req = new NextRequest('http://localhost/api/modules/config', {
        method: 'POST',
        body: JSON.stringify({ id: 'x', name: 'Mod' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Rule #5: Config writes are upserts keyed by moduleId
  // -----------------------------------------------------------------------

  describe('Rule #5: POST upserts by moduleId', () => {
    it('calls prisma upsert with sanitized moduleId as where key', async () => {
      mockPrisma.installedModule.upsert.mockResolvedValue({
        id: '1',
        moduleId: 'test-mod',
        name: 'Test Module',
        version: '1.0.0',
        enabled: true,
      });

      const { POST } = await import('@/app/api/modules/config/route');
      const req = new NextRequest('http://localhost/api/modules/config', {
        method: 'POST',
        body: JSON.stringify({
          id: 'test-mod',
          name: 'Test Module',
          version: '1.0.0',
          enabled: true,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockPrisma.installedModule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleId: 'test-mod' },
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Rule #7: IDs/names/versions sanitized before persistence
  // -----------------------------------------------------------------------

  describe('Rule #7: Inputs are sanitized before persistence', () => {
    it('sanitizes id, name, and version via sanitizers.name', async () => {
      mockPrisma.installedModule.upsert.mockResolvedValue({
        id: '1',
        moduleId: 'padded-id',
      });

      const { POST } = await import('@/app/api/modules/config/route');
      const req = new NextRequest('http://localhost/api/modules/config', {
        method: 'POST',
        body: JSON.stringify({
          id: '  padded-id  ',
          name: '  Padded Name  ',
          version: '  1.0.0  ',
          enabled: true,
        }),
      });

      await POST(req);

      const call = mockPrisma.installedModule.upsert.mock.calls[0][0];
      expect(call.where.moduleId).toBe('padded-id');
      expect(call.create.name).toBe('Padded Name');
      expect(call.create.version).toBe('1.0.0');
    });
  });
});

// =========================================================================
// Per-Module Config Routes — [moduleId]
// =========================================================================

describe('Modules — Config [moduleId] API (Business Rules)', () => {
  // -----------------------------------------------------------------------
  // Rule #10: Per-module lookup returns 404 for unknown ID
  // -----------------------------------------------------------------------

  describe('Rule #10: GET returns 404 for unknown module ID', () => {
    it('returns 404 when module does not exist', async () => {
      mockPrisma.installedModule.findUnique.mockResolvedValue(null);

      const { GET } = await import(
        '@/app/api/modules/config/[moduleId]/route'
      );
      const req = new NextRequest(
        'http://localhost/api/modules/config/nonexistent'
      );
      const res = await GET(req, { params: { moduleId: 'nonexistent' } });

      expect(res.status).toBe(404);
    });

    it('returns config when module exists', async () => {
      mockPrisma.installedModule.findUnique.mockResolvedValue({
        id: '1',
        moduleId: 'existing',
        config: { id: 'existing', name: 'Mod', version: '1.0.0' },
      });

      const { GET } = await import(
        '@/app/api/modules/config/[moduleId]/route'
      );
      const req = new NextRequest(
        'http://localhost/api/modules/config/existing'
      );
      const res = await GET(req, { params: { moduleId: 'existing' } });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe('existing');
    });
  });

  // -----------------------------------------------------------------------
  // Rule #11: Per-module delete is a hard removal
  // -----------------------------------------------------------------------

  describe('Rule #11: DELETE is a hard removal', () => {
    it('deletes the module from the database', async () => {
      mockPrisma.installedModule.findUnique.mockResolvedValue({
        id: '1',
        moduleId: 'to-delete',
      });
      mockPrisma.installedModule.delete.mockResolvedValue({});

      const { DELETE } = await import(
        '@/app/api/modules/config/[moduleId]/route'
      );
      const req = new NextRequest(
        'http://localhost/api/modules/config/to-delete'
      );
      const res = await DELETE(req, { params: { moduleId: 'to-delete' } });

      expect(res.status).toBe(200);
      expect(mockPrisma.installedModule.delete).toHaveBeenCalledWith({
        where: { moduleId: 'to-delete' },
      });
    });

    it('returns 404 when deleting non-existent module', async () => {
      mockPrisma.installedModule.findUnique.mockResolvedValue(null);

      const { DELETE } = await import(
        '@/app/api/modules/config/[moduleId]/route'
      );
      const req = new NextRequest(
        'http://localhost/api/modules/config/ghost'
      );
      const res = await DELETE(req, { params: { moduleId: 'ghost' } });

      expect(res.status).toBe(404);
    });
  });
});
