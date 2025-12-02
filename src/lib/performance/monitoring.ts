/**
 * Performance Monitoring Utilities
 *
 * Tracks Web Vitals and custom performance metrics
 * for monitoring application performance.
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
  id?: string;
  delta?: number;
}

export interface CustomMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// WEB VITALS THRESHOLDS
// ============================================================================

const WEB_VITALS_THRESHOLDS = {
  // Cumulative Layout Shift (CLS)
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  // First Input Delay (FID)
  FID: {
    good: 100,
    needsImprovement: 300,
  },
  // First Contentful Paint (FCP)
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  // Largest Contentful Paint (LCP)
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  // Time to First Byte (TTFB)
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
  // Interaction to Next Paint (INP)
  INP: {
    good: 200,
    needsImprovement: 500,
  },
};

// ============================================================================
// RATING FUNCTIONS
// ============================================================================

function getRating(
  value: number,
  thresholds: { good: number; needsImprovement: number }
): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) {
    return 'good';
  }
  if (value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  }
  return 'poor';
}

// ============================================================================
// WEB VITALS TRACKING
// ============================================================================

/**
 * Send Web Vitals metric to analytics
 *
 * In production, you would send this to your analytics service (Google Analytics, Sentry, etc.)
 * For now, we log to console in development and can send to Sentry in production
 */
export function sendToAnalytics(metric: PerformanceMetric) {
  // Log in development
  if (process.env.NODE_ENV === 'development') {
    const emoji =
      metric.rating === 'good'
        ? '✅'
        : metric.rating === 'needs-improvement'
          ? '⚠️'
          : '❌';
    logger.debug(
      'PerformanceMetrics',
      `${emoji} ${metric.name}: ${Math.round(metric.value)}${metric.name === 'CLS' ? '' : 'ms'} (${metric.rating})`
    );
  }

  // Log all metrics
  logger.performance(`${metric.name}: ${metric.value}`, {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    id: metric.id,
  });

  // TODO: Send to analytics service
  // Examples:
  // - Google Analytics: gtag('event', metric.name, { value: metric.value, metric_rating: metric.rating })
  // - Sentry: Sentry.setMeasurement(metric.name, metric.value, metric.unit)
  // - Custom endpoint: fetch('/api/metrics', { method: 'POST', body: JSON.stringify(metric) })
}

/**
 * Track all Core Web Vitals using the web-vitals library
 *
 * This should be called in _app.tsx or layout.tsx
 */
export async function trackWebVitals() {
  try {
    // Dynamic import to reduce bundle size
    const { onCLS, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals');

    // Track Cumulative Layout Shift
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onCLS((metric: any) => {
      sendToAnalytics({
        name: 'CLS',
        value: metric.value,
        rating: getRating(metric.value, WEB_VITALS_THRESHOLDS.CLS),
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    // Track First Contentful Paint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFCP((metric: any) => {
      sendToAnalytics({
        name: 'FCP',
        value: metric.value,
        rating: getRating(metric.value, WEB_VITALS_THRESHOLDS.FCP),
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    // Track Largest Contentful Paint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onLCP((metric: any) => {
      sendToAnalytics({
        name: 'LCP',
        value: metric.value,
        rating: getRating(metric.value, WEB_VITALS_THRESHOLDS.LCP),
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    // Track Time to First Byte
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onTTFB((metric: any) => {
      sendToAnalytics({
        name: 'TTFB',
        value: metric.value,
        rating: getRating(metric.value, WEB_VITALS_THRESHOLDS.TTFB),
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });

    // Track Interaction to Next Paint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onINP((metric: any) => {
      sendToAnalytics({
        name: 'INP',
        value: metric.value,
        rating: getRating(metric.value, WEB_VITALS_THRESHOLDS.INP),
        id: metric.id,
        navigationType: metric.navigationType,
      });
    });
  } catch (error) {
    logger.error('Failed to track Web Vitals', error);
  }
}

// ============================================================================
// CUSTOM PERFORMANCE TRACKING
// ============================================================================

const customMetrics: CustomMetric[] = [];
const METRICS_BUFFER_SIZE = 100;

/**
 * Track a custom performance metric
 */
export function trackMetric(
  name: string,
  value: number,
  unit: 'ms' | 'bytes' | 'count' = 'ms',
  metadata?: Record<string, unknown>
) {
  const metric: CustomMetric = {
    name,
    value,
    unit,
    timestamp: Date.now(),
    metadata,
  };

  customMetrics.push(metric);

  // Keep buffer size manageable
  if (customMetrics.length > METRICS_BUFFER_SIZE) {
    customMetrics.shift();
  }

  // Log slow operations
  if (unit === 'ms' && value > 1000) {
    logger.warn(`Slow operation detected: ${name} took ${value}ms`, { metric });
  }

  return metric;
}

/**
 * Get all tracked custom metrics
 */
export function getCustomMetrics(): CustomMetric[] {
  return [...customMetrics];
}

/**
 * Clear custom metrics buffer
 */
export function clearCustomMetrics() {
  customMetrics.length = 0;
}

// ============================================================================
// PERFORMANCE BUDGET
// ============================================================================

export const PERFORMANCE_BUDGET = {
  // Page load metrics (ms)
  FCP: 1800, // First Contentful Paint
  LCP: 2500, // Largest Contentful Paint
  TTFB: 800, // Time to First Byte
  FID: 100, // First Input Delay
  INP: 200, // Interaction to Next Paint

  // Layout stability
  CLS: 0.1, // Cumulative Layout Shift

  // API response time (ms)
  apiResponseTime: 1000,
  slowQueryThreshold: 100,

  // Component render time (ms)
  componentRenderTime: 16, // 60fps = 16ms per frame

  // Bundle size (KB)
  maxPageSize: 500,
  maxChunkSize: 200,
};

/**
 * Check if a metric exceeds the performance budget
 */
export function exceedsBudget(
  metricName: keyof typeof PERFORMANCE_BUDGET,
  value: number
): boolean {
  const budget = PERFORMANCE_BUDGET[metricName];
  return value > budget;
}

// ============================================================================
// REACT PROFILER CALLBACK
// ============================================================================

export interface ProfilerData {
  id: string;
  phase: 'mount' | 'update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

/**
 * React Profiler callback to track component render performance
 *
 * Usage:
 * ```tsx
 * import { Profiler } from 'react';
 * import { onRenderCallback } from '@/lib/performance/monitoring';
 *
 * <Profiler id="MyComponent" onRender={onRenderCallback}>
 *   <MyComponent />
 * </Profiler>
 * ```
 */
export function onRenderCallback(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  const data: ProfilerData = {
    id,
    phase: phase as 'mount' | 'update', // Cast nested-update to update for tracking
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  };

  // Track slow renders
  if (actualDuration > PERFORMANCE_BUDGET.componentRenderTime) {
    logger.warn(
      `Slow ${phase} detected in ${id}: ${actualDuration.toFixed(2)}ms`,
      data
    );

    trackMetric(`component.${id}.${phase}`, actualDuration, 'ms', {
      baseDuration,
      exceeded: true,
    });
  } else {
    trackMetric(`component.${id}.${phase}`, actualDuration, 'ms', {
      baseDuration,
    });
  }
}

// ============================================================================
// API TIMING UTILITIES
// ============================================================================

/**
 * Measure API endpoint execution time
 *
 * Usage:
 * ```ts
 * const timer = startApiTimer('GET /api/customers');
 * // ... do work ...
 * timer.end();
 * ```
 */
export function startApiTimer(endpoint: string) {
  const startTime = performance.now();

  return {
    end: () => {
      const duration = performance.now() - startTime;
      trackMetric(`api.${endpoint}`, duration, 'ms');

      if (exceedsBudget('apiResponseTime', duration)) {
        logger.warn(
          `Slow API endpoint: ${endpoint} took ${duration.toFixed(2)}ms`
        );
      }

      return duration;
    },
  };
}

// ============================================================================
// MEMORY TRACKING
// ============================================================================

/**
 * Get current memory usage (browser only)
 */
export function getMemoryUsage() {
  if (
    typeof window === 'undefined' ||
    !(performance as unknown as { memory?: unknown }).memory
  ) {
    return null;
  }

  const memory = (
    performance as unknown as {
      memory: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }
  ).memory;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    usedPercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
  };
}

/**
 * Track memory usage
 */
export function trackMemoryUsage() {
  const usage = getMemoryUsage();
  if (!usage) {
    return;
  }

  trackMetric('memory.used', usage.usedJSHeapSize, 'bytes');
  trackMetric('memory.total', usage.totalJSHeapSize, 'bytes');
  trackMetric('memory.usedPercentage', usage.usedPercentage, 'count');

  // Warn if memory usage is high
  if (usage.usedPercentage > 90) {
    logger.warn('High memory usage detected', usage);
  }
}
