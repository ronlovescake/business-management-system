/**
 * API Performance Timing Middleware
 * 
 * Tracks API endpoint response times and logs slow operations.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { PERFORMANCE_BUDGET } from './monitoring';

interface RequestTiming {
  endpoint: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Store recent API timings (in-memory, limited size)
const recentTimings: RequestTiming[] = [];
const MAX_TIMINGS = 100;

/**
 * Middleware to track API request timing
 * 
 * Usage in API route:
 * ```ts
 * import { withTiming } from '@/lib/performance/api-timing';
 * 
 * export const GET = withTiming(async (request: NextRequest) => {
 *   // Your handler code
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withTiming<T>(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse<T>>
) {
  return async function timedHandler(request: NextRequest, ...args: unknown[]): Promise<NextResponse<T>> {
    const endpoint = request.nextUrl.pathname;
    const method = request.method;
    const startTime = performance.now();

    const timing: RequestTiming = {
      endpoint,
      method,
      startTime,
    };

    try {
      // Execute the handler
      const response = await handler(request, ...args);

      // Record timing
      const endTime = performance.now();
      const duration = endTime - startTime;

      timing.endTime = endTime;
      timing.duration = duration;

      // Add to recent timings
      recentTimings.push(timing);
      if (recentTimings.length > MAX_TIMINGS) {
        recentTimings.shift();
      }

      // Log slow endpoints
      if (duration > PERFORMANCE_BUDGET.apiResponseTime) {
        logger.warn(`⏱️  Slow API endpoint: ${method} ${endpoint} took ${duration.toFixed(2)}ms`, {
          endpoint,
          method,
          duration,
          budget: PERFORMANCE_BUDGET.apiResponseTime,
        });
      }

      // Add timing header to response
      response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);

      return response;
    } catch (error) {
      // Record failed request timing
      const endTime = performance.now();
      const duration = endTime - startTime;

      timing.endTime = endTime;
      timing.duration = duration;

      recentTimings.push(timing);
      if (recentTimings.length > MAX_TIMINGS) {
        recentTimings.shift();
      }

      logger.error(`API error in ${method} ${endpoint} (${duration.toFixed(2)}ms)`, error);

      throw error;
    }
  };
}

/**
 * Get recent API timings for debugging
 */
export function getRecentTimings(): RequestTiming[] {
  return [...recentTimings];
}

/**
 * Get average response time by endpoint
 */
export function getAverageResponseTime(endpoint?: string): number | Record<string, number> {
  if (endpoint) {
    const filtered = recentTimings.filter((t) => t.endpoint === endpoint && t.duration !== undefined);
    if (filtered.length === 0) {
      return 0;
    }
    const total = filtered.reduce((sum, t) => sum + (t.duration || 0), 0);
    return total / filtered.length;
  }

  // Get average per endpoint
  const byEndpoint: Record<string, number[]> = {};
  
  recentTimings.forEach((t) => {
    if (t.duration !== undefined) {
      if (!byEndpoint[t.endpoint]) {
        byEndpoint[t.endpoint] = [];
      }
      byEndpoint[t.endpoint].push(t.duration);
    }
  });

  const averages: Record<string, number> = {};
  Object.keys(byEndpoint).forEach((ep) => {
    const durations = byEndpoint[ep];
    averages[ep] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  });

  return averages;
}

/**
 * Get slowest endpoints
 */
export function getSlowestEndpoints(limit = 10): Array<{ endpoint: string; avgDuration: number; count: number }> {
  const byEndpoint: Record<string, number[]> = {};

  recentTimings.forEach((t) => {
    if (t.duration !== undefined) {
      if (!byEndpoint[t.endpoint]) {
        byEndpoint[t.endpoint] = [];
      }
      byEndpoint[t.endpoint].push(t.duration);
    }
  });

  const results = Object.keys(byEndpoint).map((endpoint) => {
    const durations = byEndpoint[endpoint];
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    return {
      endpoint,
      avgDuration,
      count: durations.length,
    };
  });

  return results.sort((a, b) => b.avgDuration - a.avgDuration).slice(0, limit);
}

/**
 * Clear timing history
 */
export function clearTimings() {
  recentTimings.length = 0;
}
