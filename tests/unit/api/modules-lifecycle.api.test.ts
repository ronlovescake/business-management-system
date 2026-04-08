/**
 * Modules — Lifecycle API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/module-marketplace-and-module-operations.md:
 *   #12 — Install accepts moduleId + optional version, force, skipDependencies
 *   #13 — Install rejects already-installed unless force=true (409 Conflict)
 *   #14 — Update requires module ID, initializes plugin manager first
 *   #15 — Update of not-installed module → 404
 *   #16 — Reload POST = HMR refresh, returns success/duration/message
 *   #17 — Reload GET = HMR statistics + pending reloads
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- hoisted mocks ----

const { mockPluginManager, mockModuleHMR } = vi.hoisted(() => ({
  mockPluginManager: {
    initialize: vi.fn(),
    installModule: vi.fn(),
    updateModule: vi.fn(),
    uninstallModule: vi.fn(),
  },
  mockModuleHMR: {
    reloadModule: vi.fn(),
    getStatistics: vi.fn(),
    getPendingReloads: vi.fn(),
  },
}));

vi.mock('@/core/PluginManager', () => ({
  pluginManager: mockPluginManager,
}));

vi.mock('@/core/ModuleHMR', () => ({
  moduleHMR: mockModuleHMR,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: { name: (v: string) => v.trim() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// Install API
// =========================================================================

describe('Modules — Install API (Business Rules)', () => {
  // -----------------------------------------------------------------------
  // Rule #12: Install accepts moduleId + optional version, force, skipDependencies
  // -----------------------------------------------------------------------

  describe('Rule #12: Install accepts moduleId with optional params', () => {
    it('requires moduleId', async () => {
      const { POST } = await import('@/app/api/modules/install/route');
      const req = new NextRequest('http://localhost/api/modules/install', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('installs with just moduleId', async () => {
      mockPluginManager.installModule.mockResolvedValue(undefined);
      mockPluginManager.initialize.mockResolvedValue(undefined);

      const { POST } = await import('@/app/api/modules/install/route');
      const req = new NextRequest('http://localhost/api/modules/install', {
        method: 'POST',
        body: JSON.stringify({ moduleId: 'my-module' }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockPluginManager.installModule).toHaveBeenCalledWith(
        'my-module',
        { version: undefined, force: false, skipDependencies: false }
      );
    });

    it('passes optional force and skipDependencies flags', async () => {
      mockPluginManager.installModule.mockResolvedValue(undefined);
      mockPluginManager.initialize.mockResolvedValue(undefined);

      const { POST } = await import('@/app/api/modules/install/route');
      const req = new NextRequest('http://localhost/api/modules/install', {
        method: 'POST',
        body: JSON.stringify({
          moduleId: 'my-module',
          version: '2.0.0',
          force: true,
          skipDependencies: true,
        }),
      });
      await POST(req);

      expect(mockPluginManager.installModule).toHaveBeenCalledWith(
        'my-module',
        { version: '2.0.0', force: true, skipDependencies: true }
      );
    });
  });

  // -----------------------------------------------------------------------
  // Rule #13: Install rejects already-installed unless force=true (409)
  // -----------------------------------------------------------------------

  describe('Rule #13: 409 on already-installed module', () => {
    it('returns 409 Conflict when ALREADY_INSTALLED code thrown', async () => {
      const err = new Error('Module already installed');
      (err as unknown as { code: string }).code = 'ALREADY_INSTALLED';
      mockPluginManager.installModule.mockRejectedValue(err);
      mockPluginManager.initialize.mockResolvedValue(undefined);

      const { POST } = await import('@/app/api/modules/install/route');
      const req = new NextRequest('http://localhost/api/modules/install', {
        method: 'POST',
        body: JSON.stringify({ moduleId: 'dup-module' }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.code).toBe('ALREADY_INSTALLED');
    });

    it('returns 500 for other install errors', async () => {
      mockPluginManager.installModule.mockRejectedValue(
        new Error('Network failure')
      );
      mockPluginManager.initialize.mockResolvedValue(undefined);

      const { POST } = await import('@/app/api/modules/install/route');
      const req = new NextRequest('http://localhost/api/modules/install', {
        method: 'POST',
        body: JSON.stringify({ moduleId: 'fail-module' }),
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
    });
  });
});

// =========================================================================
// Update API
// =========================================================================

describe('Modules — Update API (Business Rules)', () => {
  // -----------------------------------------------------------------------
  // Rule #14: Update requires module ID, initializes plugin manager first
  // -----------------------------------------------------------------------

  describe('Rule #14: Update requires moduleId', () => {
    it('rejects when moduleId is missing', async () => {
      const { POST } = await import('@/app/api/modules/update/route');
      const req = new NextRequest('http://localhost/api/modules/update', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('initializes plugin manager before updating', async () => {
      mockPluginManager.initialize.mockResolvedValue(undefined);
      mockPluginManager.updateModule.mockResolvedValue(undefined);

      const { POST } = await import('@/app/api/modules/update/route');
      const req = new NextRequest('http://localhost/api/modules/update', {
        method: 'POST',
        body: JSON.stringify({ moduleId: 'my-module' }),
      });
      await POST(req);

      expect(mockPluginManager.initialize).toHaveBeenCalled();
      expect(mockPluginManager.updateModule).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Rule #15: Update of not-installed module → 404
  // -----------------------------------------------------------------------

  describe('Rule #15: Update of not-installed module → 404', () => {
    it('returns 404 when NOT_INSTALLED code thrown', async () => {
      const err = new Error('Module not installed');
      (err as unknown as { code: string }).code = 'NOT_INSTALLED';
      mockPluginManager.updateModule.mockRejectedValue(err);
      mockPluginManager.initialize.mockResolvedValue(undefined);

      const { POST } = await import('@/app/api/modules/update/route');
      const req = new NextRequest('http://localhost/api/modules/update', {
        method: 'POST',
        body: JSON.stringify({ moduleId: 'unknown-module' }),
      });
      const res = await POST(req);

      expect(res.status).toBe(404);
    });
  });
});

// =========================================================================
// Reload API
// =========================================================================

describe('Modules — Reload API (Business Rules)', () => {
  // -----------------------------------------------------------------------
  // Rule #16: Reload POST = HMR refresh, returns success/duration/message
  // -----------------------------------------------------------------------

  describe('Rule #16: POST triggers HMR reload', () => {
    it('returns success/duration/message on successful reload', async () => {
      mockModuleHMR.reloadModule.mockResolvedValue({
        success: true,
        moduleId: 'test-mod',
        reloaded: true,
        duration: 42,
      });

      const { POST } = await import('@/app/api/modules/reload/route');
      const req = new NextRequest('http://localhost/api/modules/reload', {
        method: 'POST',
        body: JSON.stringify({ moduleId: 'test-mod' }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.duration).toBeDefined();
    });

    it('rejects request without moduleId', async () => {
      const { POST } = await import('@/app/api/modules/reload/route');
      const req = new NextRequest('http://localhost/api/modules/reload', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Rule #17: Reload GET = HMR statistics + pending reloads
  // -----------------------------------------------------------------------

  describe('Rule #17: GET returns HMR statistics', () => {
    it('returns stats and pending reloads', async () => {
      mockModuleHMR.getStatistics.mockReturnValue({
        totalReloads: 10,
        failedReloads: 1,
        avgDuration: 35,
      });
      mockModuleHMR.getPendingReloads.mockReturnValue(['mod-a']);

      const { GET } = await import('@/app/api/modules/reload/route');
      const req = new NextRequest('http://localhost/api/modules/reload');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.statistics).toBeDefined();
      expect(json.pendingReloads).toBeDefined();
    });
  });
});
