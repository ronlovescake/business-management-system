/**
 * Modules — Performance API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/module-marketplace-and-module-operations.md:
 *   #25 — Performance GET: whole-platform or per-module reports
 *   #26 — Performance POST actions: optimize, warmCache, preload, prefetch, clear
 *   #27 — preload/prefetch require a specific moduleId
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- hoisted mocks ----

const { mockModulePerformance } = vi.hoisted(() => ({
  mockModulePerformance: {
    getMetrics: vi.fn(),
    getAverageLoadTime: vi.fn(),
    getCacheHitRate: vi.fn(),
    exportPerformanceReport: vi.fn(),
    optimizeLoadingStrategy: vi.fn(),
    warmCache: vi.fn(),
    preloadModule: vi.fn(),
    prefetchModule: vi.fn(),
    clearMetrics: vi.fn(),
  },
}));

vi.mock('@/core/ModulePerformance', () => ({
  modulePerformance: mockModulePerformance,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: { name: (v: string) => v.trim() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// Rule #25: Performance GET: whole-platform or per-module reports
// =========================================================================

describe('Rule #25: Performance GET returns whole-platform or per-module reports', () => {
  it('returns full report when no moduleId param', async () => {
    mockModulePerformance.exportPerformanceReport.mockReturnValue({
      modules: [],
      totalLoadTime: 500,
    });

    const { GET } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest('http://localhost/api/modules/performance');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(mockModulePerformance.exportPerformanceReport).toHaveBeenCalled();
  });

  it('returns per-module report when moduleId param present', async () => {
    mockModulePerformance.getMetrics.mockReturnValue([]);
    mockModulePerformance.getAverageLoadTime.mockReturnValue(35);
    mockModulePerformance.getCacheHitRate.mockReturnValue(0.85);

    const { GET } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest(
      'http://localhost/api/modules/performance?moduleId=test-mod'
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.moduleId).toBe('test-mod');
    expect(json.data.averageLoadTime).toBe(35);
    expect(json.data.cacheHitRate).toBe(0.85);
  });
});

// =========================================================================
// Rule #26: Performance POST actions
// =========================================================================

describe('Rule #26: Performance POST supports optimize, warmCache, preload, prefetch, clear', () => {
  it('optimize action calls optimizeLoadingStrategy', async () => {
    const { POST } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest('http://localhost/api/modules/performance', {
      method: 'POST',
      body: JSON.stringify({ action: 'optimize' }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockModulePerformance.optimizeLoadingStrategy).toHaveBeenCalled();
  });

  it('warmCache action calls warmCache with priority', async () => {
    mockModulePerformance.warmCache.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest('http://localhost/api/modules/performance', {
      method: 'POST',
      body: JSON.stringify({ action: 'warmCache', strategy: 'high' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockModulePerformance.warmCache).toHaveBeenCalledWith('high');
  });
});

// =========================================================================
// Rule #27: preload/prefetch require a specific moduleId
// =========================================================================

describe('Rule #27: preload/prefetch require a specific moduleId', () => {
  it('preload returns 400 when moduleId missing', async () => {
    const { POST } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest('http://localhost/api/modules/performance', {
      method: 'POST',
      body: JSON.stringify({ action: 'preload' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/moduleId/i);
  });

  it('prefetch returns 400 when moduleId missing', async () => {
    const { POST } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest('http://localhost/api/modules/performance', {
      method: 'POST',
      body: JSON.stringify({ action: 'prefetch' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/moduleId/i);
  });

  it('preload succeeds with moduleId', async () => {
    mockModulePerformance.preloadModule.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest('http://localhost/api/modules/performance', {
      method: 'POST',
      body: JSON.stringify({ action: 'preload', moduleId: 'test-mod' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockModulePerformance.preloadModule).toHaveBeenCalledWith('test-mod');
  });

  it('prefetch succeeds with moduleId', async () => {
    mockModulePerformance.prefetchModule.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/modules/performance/route');
    const req = new NextRequest('http://localhost/api/modules/performance', {
      method: 'POST',
      body: JSON.stringify({ action: 'prefetch', moduleId: 'test-mod' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockModulePerformance.prefetchModule).toHaveBeenCalledWith(
      'test-mod'
    );
  });
});
