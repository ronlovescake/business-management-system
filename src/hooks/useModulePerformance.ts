/**
 * React Hook for Module Performance Monitoring
 *
 * This hook provides:
 * - Performance metrics tracking
 * - Lazy loading utilities
 * - Cache warming
 * - Resource hints
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { modulePerformance } from '@/core/ModulePerformance';
import type {
  LazyLoadOptions,
  LazyLoadStrategy,
  CacheStrategy,
} from '@/core/ModulePerformance';

// ============================================================================
// HOOK: useModulePerformance
// ============================================================================

export interface UseModulePerformanceOptions {
  /**
   * Module ID to track
   */
  moduleId: string;

  /**
   * Lazy load strategy
   */
  lazyLoad?: LazyLoadOptions;

  /**
   * Cache strategy
   */
  cacheStrategy?: CacheStrategy;

  /**
   * Whether to track performance metrics
   */
  trackMetrics?: boolean;

  /**
   * Whether to prefetch module resources
   */
  prefetch?: boolean;
}

export interface UseModulePerformanceReturn {
  /**
   * Average load time in milliseconds
   */
  averageLoadTime: number;

  /**
   * Cache hit rate (0-1)
   */
  cacheHitRate: number;

  /**
   * Whether module is preloaded
   */
  isPreloaded: boolean;

  /**
   * Preload the module
   */
  preload: () => Promise<void>;

  /**
   * Setup visibility observer for lazy loading
   */
  setupVisibilityObserver: (element: Element) => void;

  /**
   * Setup interaction-based lazy loading
   */
  setupInteractionLoader: (element: Element, events?: string[]) => void;
}

/**
 * Hook for module performance optimization
 */
export function useModulePerformance(
  options: UseModulePerformanceOptions
): UseModulePerformanceReturn {
  const {
    moduleId,
    lazyLoad,
    cacheStrategy,
    trackMetrics = true,
    prefetch = false,
  } = options;

  const preloadedRef = useRef(false);

  // Register lazy loading strategy
  useEffect(() => {
    if (lazyLoad) {
      modulePerformance.registerLazyModule(moduleId, lazyLoad);
    }
  }, [moduleId, lazyLoad]);

  // Set cache strategy
  useEffect(() => {
    if (cacheStrategy) {
      modulePerformance.setCacheStrategy(moduleId, cacheStrategy);
    }
  }, [moduleId, cacheStrategy]);

  // Prefetch if enabled
  useEffect(() => {
    if (prefetch) {
      modulePerformance.prefetchModule(moduleId);
    }
  }, [moduleId, prefetch]);

  // Preload function
  const preload = useCallback(async () => {
    if (preloadedRef.current) return;

    await modulePerformance.preloadModule(moduleId);
    preloadedRef.current = true;
  }, [moduleId]);

  // Setup visibility observer
  const setupVisibilityObserver = useCallback(
    (element: Element) => {
      if (lazyLoad && lazyLoad.strategy === 'visible') {
        modulePerformance.setupVisibilityObserver(moduleId, element, lazyLoad);
      }
    },
    [moduleId, lazyLoad]
  );

  // Setup interaction loader
  const setupInteractionLoader = useCallback(
    (element: Element, events?: string[]) => {
      modulePerformance.setupInteractionLoader(moduleId, element, events);
    },
    [moduleId]
  );

  // Get performance metrics
  const averageLoadTime = trackMetrics
    ? modulePerformance.getAverageLoadTime(moduleId)
    : 0;

  const cacheHitRate = trackMetrics
    ? modulePerformance.getCacheHitRate(moduleId)
    : 0;

  return {
    averageLoadTime,
    cacheHitRate,
    isPreloaded: preloadedRef.current,
    preload,
    setupVisibilityObserver,
    setupInteractionLoader,
  };
}

// ============================================================================
// HOOK: useLazyModule
// ============================================================================

export interface UseLazyModuleOptions {
  /**
   * Lazy load strategy
   */
  strategy?: LazyLoadStrategy;

  /**
   * Priority
   */
  priority?: 'high' | 'medium' | 'low';

  /**
   * Whether to preload
   */
  preload?: boolean;

  /**
   * Root margin for visibility observer
   */
  rootMargin?: string;

  /**
   * Threshold for visibility observer
   */
  threshold?: number;
}

/**
 * Simplified hook for lazy loading modules
 */
export function useLazyModule(
  moduleId: string,
  options: UseLazyModuleOptions = {}
): {
  elementRef: (element: Element | null) => void;
  preload: () => Promise<void>;
} {
  const elementRef = useRef<Element | null>(null);

  const {
    strategy = 'visible',
    priority = 'medium',
    preload: shouldPreload = false,
    rootMargin = '50px',
    threshold = 0.1,
  } = options;

  const lazyLoadOptions: LazyLoadOptions = {
    strategy,
    priority,
    preload: shouldPreload,
    rootMargin,
    threshold,
  };

  const { preload, setupVisibilityObserver } = useModulePerformance({
    moduleId,
    lazyLoad: lazyLoadOptions,
  });

  // Ref callback to setup observers
  const setElementRef = useCallback(
    (element: Element | null) => {
      if (!element) return;

      elementRef.current = element;

      if (strategy === 'visible') {
        setupVisibilityObserver(element);
      }
    },
    [strategy, setupVisibilityObserver]
  );

  return {
    elementRef: setElementRef,
    preload,
  };
}

// ============================================================================
// HOOK: useModuleCache
// ============================================================================

export interface UseModuleCacheOptions {
  /**
   * Cache type
   */
  type?: 'memory' | 'persistent';

  /**
   * Max age in milliseconds
   */
  maxAge?: number;

  /**
   * Priority
   */
  priority?: number;

  /**
   * Whether to preload
   */
  preload?: boolean;
}

/**
 * Hook for managing module cache
 */
export function useModuleCache(
  moduleId: string,
  options: UseModuleCacheOptions = {}
): {
  strategy: CacheStrategy | undefined;
  setStrategy: (strategy: CacheStrategy) => void;
} {
  const {
    type = 'memory',
    maxAge = 30 * 60 * 1000,
    priority = 5,
    preload = false,
  } = options;

  useEffect(() => {
    const defaultStrategy: CacheStrategy = {
      type,
      maxAge,
      priority,
      preload,
    };

    modulePerformance.setCacheStrategy(moduleId, defaultStrategy);
  }, [moduleId, type, maxAge, priority, preload]);

  const setStrategy = useCallback(
    (strategy: CacheStrategy) => {
      modulePerformance.setCacheStrategy(moduleId, strategy);
    },
    [moduleId]
  );

  const strategy = modulePerformance.getCacheStrategy(moduleId);

  return {
    strategy,
    setStrategy,
  };
}

// ============================================================================
// HOOK: usePerformanceMetrics
// ============================================================================

/**
 * Hook to get performance metrics for a module
 */
export function usePerformanceMetrics(moduleId: string): {
  averageLoadTime: number;
  cacheHitRate: number;
  metricsCount: number;
} {
  const metrics = modulePerformance.getMetrics(moduleId);
  const averageLoadTime = modulePerformance.getAverageLoadTime(moduleId);
  const cacheHitRate = modulePerformance.getCacheHitRate(moduleId);

  return {
    averageLoadTime,
    cacheHitRate,
    metricsCount: metrics.length,
  };
}

// ============================================================================
// HOOK: useWarmCache
// ============================================================================

/**
 * Hook to warm up cache on mount
 */
export function useWarmCache(priority: 'high' | 'medium' | 'low' = 'medium'): {
  isWarming: boolean;
  warm: () => Promise<void>;
} {
  const isWarmingRef = useRef(false);

  const warm = useCallback(async () => {
    if (isWarmingRef.current) return;

    isWarmingRef.current = true;
    await modulePerformance.warmCache(priority);
    isWarmingRef.current = false;
  }, [priority]);

  useEffect(() => {
    warm();
  }, [warm]);

  return {
    isWarming: isWarmingRef.current,
    warm,
  };
}
