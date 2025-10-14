/**
 * Module Performance Optimizer
 *
 * This service handles:
 * - Lazy loading strategies (route-based, viewport-based, interaction-based)
 * - Module-level code splitting
 * - Intelligent caching and preloading
 * - Performance metrics and monitoring
 * - Resource hints (prefetch, preload, preconnect)
 */

import { moduleLoader } from './ModuleLoader';
import { moduleRegistry } from './ModuleRegistry';

// ============================================================================
// PERFORMANCE TYPES
// ============================================================================

export type LazyLoadStrategy =
  | 'immediate' // Load immediately
  | 'idle' // Load when browser is idle
  | 'visible' // Load when in viewport
  | 'interaction' // Load on user interaction
  | 'route' // Load when route is active
  | 'manual'; // Manual control

export interface LazyLoadOptions {
  strategy: LazyLoadStrategy;
  priority?: 'high' | 'medium' | 'low';
  preload?: boolean;
  timeout?: number;
  rootMargin?: string; // For IntersectionObserver (visible strategy)
  threshold?: number; // For IntersectionObserver
}

export interface ModuleChunk {
  moduleId: string;
  chunkName: string;
  size: number;
  priority: number;
  dependencies: string[];
  loaded: boolean;
}

export interface CacheStrategy {
  type: 'memory' | 'persistent';
  maxAge?: number; // milliseconds
  maxSize?: number; // bytes
  priority?: number; // Higher = keep longer
  preload?: boolean; // Preload on app start
  invalidateOn?: string[]; // Events that invalidate cache
}

export interface PerformanceMetrics {
  moduleId: string;
  loadTime: number;
  parseTime: number;
  executeTime: number;
  cacheHit: boolean;
  strategy: LazyLoadStrategy;
  size: number;
  timestamp: number;
}

export interface ResourceHint {
  type: 'prefetch' | 'preload' | 'preconnect' | 'dns-prefetch';
  href: string;
  as?: string;
  crossOrigin?: string;
}

// ============================================================================
// PERFORMANCE OPTIMIZER CLASS
// ============================================================================

class ModulePerformance {
  private lazyLoadQueue = new Map<string, LazyLoadOptions>();
  private intersectionObservers = new Map<string, IntersectionObserver>();
  private idleCallbacks = new Map<string, number | NodeJS.Timeout>();
  private performanceMetrics: PerformanceMetrics[] = [];
  private chunks = new Map<string, ModuleChunk>();
  private cacheStrategies = new Map<string, CacheStrategy>();
  private preloadedModules = new Set<string>();

  /**
   * Register a module for lazy loading
   */
  registerLazyModule(moduleId: string, options: LazyLoadOptions): void {
    this.lazyLoadQueue.set(moduleId, options);

    // Execute strategy
    switch (options.strategy) {
      case 'immediate':
        this.loadImmediate(moduleId);
        break;
      case 'idle':
        this.loadOnIdle(moduleId, options);
        break;
      case 'visible':
        // Will be activated when element is registered
        break;
      case 'interaction':
        // Will be activated when interaction is registered
        break;
      case 'route':
        // Will be activated when route changes
        break;
      case 'manual':
        // User controls loading
        break;
    }

    logger.debug(`📦 Registered lazy module: ${moduleId} (${options.strategy})`);
  }

  /**
   * Load module immediately
   */
  private async loadImmediate(moduleId: string): Promise<void> {
    try {
      const startTime = performance.now();

      await moduleLoader.loadModule(moduleId, {
        cache: true,
        preloadDependencies: true,
      });

      const loadTime = performance.now() - startTime;

      this.recordMetrics({
        moduleId,
        loadTime,
        parseTime: 0, // Would need browser API to measure
        executeTime: 0,
        cacheHit: false,
        strategy: 'immediate',
        size: 0,
        timestamp: Date.now(),
      });

      logger.debug(
        `✅ Module loaded immediately: ${moduleId} (${loadTime.toFixed(2)}ms)`
      );
    } catch (error) {
      logger.error(`❌ Failed to load module ${moduleId}:`, error);
    }
  }

  /**
   * Load module when browser is idle
   */
  private loadOnIdle(moduleId: string, options: LazyLoadOptions): void {
    if (typeof window === 'undefined' || !('requestIdleCallback' in window)) {
      // Fallback to setTimeout
      const timeoutId = setTimeout(() => {
        this.loadImmediate(moduleId);
      }, options.timeout || 1000);

      this.idleCallbacks.set(moduleId, timeoutId);
      return;
    }

    const idleCallbackId = window.requestIdleCallback(
      () => {
        this.loadImmediate(moduleId);
        this.idleCallbacks.delete(moduleId);
      },
      { timeout: options.timeout || 5000 }
    );

    this.idleCallbacks.set(moduleId, idleCallbackId);
  }

  /**
   * Setup intersection observer for viewport-based lazy loading
   */
  setupVisibilityObserver(
    moduleId: string,
    element: Element,
    options: LazyLoadOptions
  ): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      // Fallback to immediate load
      this.loadImmediate(moduleId);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            logger.debug(`👁️ Module entering viewport: ${moduleId}`);
            this.loadImmediate(moduleId);
            observer.disconnect();
            this.intersectionObservers.delete(moduleId);
          }
        });
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.1,
      }
    );

    observer.observe(element);
    this.intersectionObservers.set(moduleId, observer);
  }

  /**
   * Setup interaction-based lazy loading
   */
  setupInteractionLoader(
    moduleId: string,
    element: Element,
    events: string[] = ['click', 'focus', 'mouseenter']
  ): void {
    const loadOnInteraction = () => {
      this.loadImmediate(moduleId);

      // Remove listeners after first interaction
      events.forEach((event) => {
        element.removeEventListener(event, loadOnInteraction);
      });
    };

    events.forEach((event) => {
      element.addEventListener(event, loadOnInteraction, { once: true });
    });

    logger.debug(`🖱️ Interaction loader setup for: ${moduleId}`);
  }

  /**
   * Preload module without executing
   */
  async preloadModule(moduleId: string): Promise<void> {
    if (this.preloadedModules.has(moduleId)) {
      return;
    }

    try {
      logger.debug(`📥 Preloading module: ${moduleId}`);

      await moduleLoader.preloadModule(moduleId);

      this.preloadedModules.add(moduleId);

      logger.debug(`✅ Module preloaded: ${moduleId}`);
    } catch (error) {
      logger.error(`❌ Failed to preload module ${moduleId}:`, error);
    }
  }

  /**
   * Preload multiple modules
   */
  async preloadModules(moduleIds: string[]): Promise<void> {
    const promises = moduleIds.map((id) => this.preloadModule(id));
    await Promise.allSettled(promises);
  }

  /**
   * Warm up cache by preloading critical modules
   */
  async warmCache(priority: 'high' | 'medium' | 'low' = 'high'): Promise<void> {
    logger.debug(`🔥 Warming cache (priority: ${priority})...`);

    // Get modules marked for preloading
    const modulesToPreload: string[] = [];

    const strategiesArray = Array.from(this.cacheStrategies.entries());
    for (const [moduleId, strategy] of strategiesArray) {
      if (strategy.preload) {
        modulesToPreload.push(moduleId);
      }
    }

    // Preload in batches to avoid overwhelming the browser
    const batchSize = priority === 'high' ? 5 : priority === 'medium' ? 3 : 1;

    for (let i = 0; i < modulesToPreload.length; i += batchSize) {
      const batch = modulesToPreload.slice(i, i + batchSize);
      await this.preloadModules(batch);

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.debug(
      `✅ Cache warmed: ${modulesToPreload.length} modules preloaded`
    );
  }

  /**
   * Register cache strategy for a module
   */
  setCacheStrategy(moduleId: string, strategy: CacheStrategy): void {
    this.cacheStrategies.set(moduleId, strategy);

    // If preload is enabled, add to preload queue
    if (strategy.preload) {
      this.preloadModule(moduleId);
    }

    logger.debug(`💾 Cache strategy set for: ${moduleId} (${strategy.type})`);
  }

  /**
   * Get cache strategy for a module
   */
  getCacheStrategy(moduleId: string): CacheStrategy | undefined {
    return this.cacheStrategies.get(moduleId);
  }

  /**
   * Register module chunk for code splitting
   */
  registerChunk(chunk: ModuleChunk): void {
    this.chunks.set(chunk.moduleId, chunk);
    logger.debug(
      `📦 Chunk registered: ${chunk.chunkName} (${chunk.size} bytes)`
    );
  }

  /**
   * Get optimal loading order based on dependencies and priority
   */
  getLoadingOrder(moduleIds: string[]): string[] {
    const ordered: string[] = [];
    const visited = new Set<string>();

    const visit = (moduleId: string) => {
      if (visited.has(moduleId)) return;

      visited.add(moduleId);

      const chunk = this.chunks.get(moduleId);
      if (chunk) {
        // Visit dependencies first
        chunk.dependencies.forEach((depId) => {
          if (moduleIds.includes(depId)) {
            visit(depId);
          }
        });
      }

      ordered.push(moduleId);
    };

    // Sort by priority first
    const sorted = [...moduleIds].sort((a, b) => {
      const chunkA = this.chunks.get(a);
      const chunkB = this.chunks.get(b);
      const priorityA = chunkA?.priority || 0;
      const priorityB = chunkB?.priority || 0;
      return priorityB - priorityA;
    });

    sorted.forEach((id) => visit(id));

    return ordered;
  }

  /**
   * Add resource hint to document head
   */
  addResourceHint(hint: ResourceHint): void {
    if (typeof document === 'undefined') return;

    const link = document.createElement('link');
    link.rel = hint.type;
    link.href = hint.href;

    if (hint.as) link.setAttribute('as', hint.as);
    if (hint.crossOrigin) link.setAttribute('crossorigin', hint.crossOrigin);

    document.head.appendChild(link);

    logger.debug(`🔗 Resource hint added: ${hint.type} ${hint.href}`);
  }

  /**
   * Prefetch module resources
   */
  prefetchModule(moduleId: string): void {
    const config = moduleRegistry.get(moduleId);

    if (!config || !config.routes) return;

    // Prefetch route components
    config.routes.forEach((route) => {
      this.addResourceHint({
        type: 'prefetch',
        href: route.path,
        as: 'document',
      });
    });
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics.push(metrics);

    // Keep only last 100 metrics
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.shift();
    }
  }

  /**
   * Get performance metrics for a module
   */
  getMetrics(moduleId: string): PerformanceMetrics[] {
    return this.performanceMetrics.filter((m) => m.moduleId === moduleId);
  }

  /**
   * Get average load time for a module
   */
  getAverageLoadTime(moduleId: string): number {
    const metrics = this.getMetrics(moduleId);

    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.loadTime, 0);
    return total / metrics.length;
  }

  /**
   * Get cache hit rate for a module
   */
  getCacheHitRate(moduleId: string): number {
    const metrics = this.getMetrics(moduleId);

    if (metrics.length === 0) return 0;

    const hits = metrics.filter((m) => m.cacheHit).length;
    return hits / metrics.length;
  }

  /**
   * Get all performance statistics
   */
  getStatistics(): {
    totalModules: number;
    lazyLoadQueue: number;
    preloadedModules: number;
    averageLoadTime: number;
    cacheHitRate: number;
    chunks: number;
    metricsCount: number;
  } {
    const totalLoadTime = this.performanceMetrics.reduce(
      (sum, m) => sum + m.loadTime,
      0
    );
    const cacheHits = this.performanceMetrics.filter((m) => m.cacheHit).length;

    return {
      totalModules: this.lazyLoadQueue.size,
      lazyLoadQueue: this.lazyLoadQueue.size,
      preloadedModules: this.preloadedModules.size,
      averageLoadTime:
        this.performanceMetrics.length > 0
          ? totalLoadTime / this.performanceMetrics.length
          : 0,
      cacheHitRate:
        this.performanceMetrics.length > 0
          ? cacheHits / this.performanceMetrics.length
          : 0,
      chunks: this.chunks.size,
      metricsCount: this.performanceMetrics.length,
    };
  }

  /**
   * Optimize module loading based on usage patterns
   */
  optimizeLoadingStrategy(): void {
    logger.debug('🔧 Analyzing usage patterns for optimization...');

    const modulesArray = Array.from(this.lazyLoadQueue.entries());

    for (const [moduleId] of modulesArray) {
      const metrics = this.getMetrics(moduleId);

      if (metrics.length < 3) continue; // Need more data

      const avgLoadTime = this.getAverageLoadTime(moduleId);
      const cacheHitRate = this.getCacheHitRate(moduleId);

      // If module is frequently used, upgrade to higher priority
      if (metrics.length > 10 && avgLoadTime < 100) {
        const newStrategy: CacheStrategy = {
          type: 'memory',
          preload: true,
          priority: 10,
          maxAge: 30 * 60 * 1000, // 30 minutes
        };

        this.setCacheStrategy(moduleId, newStrategy);

        logger.debug(
          `⚡ Optimized ${moduleId}: marked for preload (frequently used)`
        );
      }

      // If cache hit rate is low, adjust cache strategy
      if (cacheHitRate < 0.5 && metrics.length > 5) {
        logger.debug(
          `⚠️ Low cache hit rate for ${moduleId}: ${(cacheHitRate * 100).toFixed(1)}%`
        );
      }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear intersection observers
    const observersArray = Array.from(this.intersectionObservers.values());
    observersArray.forEach((observer) => observer.disconnect());
    this.intersectionObservers.clear();

    // Clear idle callbacks
    const callbacksArray = Array.from(this.idleCallbacks.values());
    callbacksArray.forEach((id) => {
      if (
        typeof id === 'number' &&
        typeof window !== 'undefined' &&
        'cancelIdleCallback' in window
      ) {
        window.cancelIdleCallback(id);
      } else if (typeof id !== 'number') {
        clearTimeout(id);
      }
    });
    this.idleCallbacks.clear();

    logger.debug('🗑️ Module performance optimizer cleaned up');
  }

  /**
   * Clear all performance data (metrics, cache strategies, etc.)
   */
  clearPerformanceData(): void {
    this.performanceMetrics = [];
    this.lazyLoadQueue.clear();
    this.preloadedModules.clear();
    this.cacheStrategies.clear();
    this.chunks.clear();

    logger.debug('🗑️ Performance data cleared');
  }

  /**
   * Export performance report
   */
  exportPerformanceReport(): {
    summary: {
      totalModules: number;
      lazyLoadQueue: number;
      preloadedModules: number;
      averageLoadTime: number;
      cacheHitRate: number;
      chunks: number;
      metricsCount: number;
    };
    metrics: PerformanceMetrics[];
    strategies: Array<{ moduleId: string; strategy: CacheStrategy }>;
    chunks: Array<ModuleChunk>;
  } {
    const strategiesArray = Array.from(this.cacheStrategies.entries()).map(
      ([moduleId, strategy]) => ({ moduleId, strategy })
    );

    const chunksArray = Array.from(this.chunks.values());

    return {
      summary: this.getStatistics(),
      metrics: [...this.performanceMetrics],
      strategies: strategiesArray,
      chunks: chunksArray,
    };
  }
}

// Singleton instance
export const modulePerformance = new ModulePerformance();

// Export class for testing
export { ModulePerformance };
