/**
 * Module Performance API Route
 *
 * Endpoints:
 * - GET /api/modules/performance - Get full performance report
 * - POST /api/modules/performance - Trigger optimization
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { modulePerformance } from '@/core/ModulePerformance';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

/**
 * GET /api/modules/performance
 *
 * Get full performance report for all modules
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const moduleIdParam = searchParams.get('moduleId');
    const moduleId = moduleIdParam ? sanitizers.name(moduleIdParam) : null;

    // Get specific module metrics
    if (moduleId) {
      const metrics = modulePerformance.getMetrics(moduleId);
      const averageLoadTime = modulePerformance.getAverageLoadTime(moduleId);
      const cacheHitRate = modulePerformance.getCacheHitRate(moduleId);

      return NextResponse.json({
        success: true,
        data: {
          moduleId,
          metrics,
          averageLoadTime,
          cacheHitRate,
        },
      });
    }

    // Get full performance report
    const report = modulePerformance.exportPerformanceReport();

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('[Performance API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/modules/performance
 *
 * Trigger performance optimization
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const actionParam = body.action;
    const moduleIdParam = body.moduleId;
    const strategyParam = body.strategy;

    // Sanitize inputs
    const action = actionParam ? sanitizers.name(actionParam) : null;
    const moduleId = moduleIdParam ? sanitizers.name(moduleIdParam) : null;
    const strategy = strategyParam ? sanitizers.name(strategyParam) : null;

    switch (action) {
      case 'optimize':
        // Optimize loading strategy for all modules
        modulePerformance.optimizeLoadingStrategy();

        return NextResponse.json({
          success: true,
          message: 'Loading strategies optimized',
        });

      case 'warmCache':
        // Warm up cache
        const priority = (strategy as 'high' | 'medium' | 'low') || 'medium';
        await modulePerformance.warmCache(priority);

        return NextResponse.json({
          success: true,
          message: 'Cache warmed successfully',
        });

      case 'preload':
        // Preload specific module
        if (!moduleId) {
          return NextResponse.json(
            {
              success: false,
              error: 'moduleId is required for preload action',
            },
            { status: 400 }
          );
        }

        await modulePerformance.preloadModule(moduleId);

        return NextResponse.json({
          success: true,
          message: `Module ${moduleId} preloaded`,
        });

      case 'prefetch':
        // Prefetch specific module
        if (!moduleId) {
          return NextResponse.json(
            {
              success: false,
              error: 'moduleId is required for prefetch action',
            },
            { status: 400 }
          );
        }

        modulePerformance.prefetchModule(moduleId);

        return NextResponse.json({
          success: true,
          message: `Module ${moduleId} prefetched`,
        });

      case 'clear':
        // Clear all performance data
        modulePerformance.clearPerformanceData();

        return NextResponse.json({
          success: true,
          message: 'Performance data cleared',
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[Performance API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
