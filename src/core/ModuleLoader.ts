/**
 * Module Loader - Dynamic Module Loading System
 *
 * This service handles:
 * - Loading modules dynamically at runtime
 * - Caching loaded modules
 * - Unloading modules and cleanup
 * - Module lifecycle management
 * - Error handling and recovery
 */

import dynamic from 'next/dynamic';
import type { Loader } from 'next/dynamic';
import type { ComponentType } from 'react';
import { moduleRegistry } from './ModuleRegistry';
import type {
  ModuleLoadOptions,
  ModuleLoadResult,
  ModuleCacheEntry,
  ModuleLifecycleEvent,
  ModuleLifecycleHandler,
} from '@/types/module-system';
import { logger } from '@/lib/logger';

// ============================================================================
// MODULE LOADER ERRORS
// ============================================================================

export class ModuleLoadError extends Error {
  constructor(
    message: string,
    public moduleId: string,
    public code: string
  ) {
    super(message);
    this.name = 'ModuleLoadError';
  }
}

export class ModuleCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModuleCacheError';
  }
}

// ============================================================================
// MODULE LOADER CLASS
// ============================================================================

class ModuleLoader {
  private cache = new Map<string, ModuleCacheEntry>();
  private loadingPromises = new Map<string, Promise<ModuleLoadResult>>();
  private eventHandlers = new Map<
    ModuleLifecycleEvent,
    Set<ModuleLifecycleHandler>
  >();
  private maxCacheSize = 50; // Maximum cached modules
  private cacheExpirationMs = 30 * 60 * 1000; // 30 minutes

  /**
   * Load a module dynamically
   */
  async loadModule<T = ComponentType>(
    moduleId: string,
    options: ModuleLoadOptions = {}
  ): Promise<ModuleLoadResult<T>> {
    try {
      // Emit beforeLoad event
      await this.emitEvent('beforeLoad', moduleId);

      // Check cache first
      if (options.cache !== false) {
        const cached = this.getFromCache<T>(moduleId);
        if (cached) {
          logger.debug(`📦 Loading module from cache: ${moduleId}`);
          await this.emitEvent('afterLoad', moduleId, cached);
          return cached;
        }
      }

      // Check if already loading
      const existingPromise = this.loadingPromises.get(moduleId);
      if (existingPromise) {
        logger.debug(`⏳ Module already loading: ${moduleId}`);
        return existingPromise as Promise<ModuleLoadResult<T>>;
      }

      // Start loading
      const loadPromise = this.performLoad<T>(moduleId, options);
      this.loadingPromises.set(moduleId, loadPromise);

      try {
        const result = await loadPromise;

        // Cache if enabled
        if (options.cache !== false) {
          this.addToCache(moduleId, result);
        }

        // Emit afterLoad event
        await this.emitEvent('afterLoad', moduleId, result);

        return result;
      } finally {
        this.loadingPromises.delete(moduleId);
      }
    } catch (error) {
      await this.emitEvent('error', moduleId, error);
      if (error instanceof ModuleLoadError) {
        throw error;
      }
      throw new ModuleLoadError(
        `Failed to load module: ${(error as Error).message}`,
        moduleId,
        'LOAD_ERROR'
      );
    }
  }

  /**
   * Perform the actual module loading
   */
  private async performLoad<T>(
    moduleId: string,
    options: ModuleLoadOptions
  ): Promise<ModuleLoadResult<T>> {
    try {
      // Get module config from registry
      const config = moduleRegistry.get(moduleId);

      if (!config) {
        throw new ModuleLoadError(
          `Module not found in registry: ${moduleId}`,
          moduleId,
          'NOT_FOUND'
        );
      }

      if (!config.enabled) {
        throw new ModuleLoadError(
          `Module is disabled: ${moduleId}`,
          moduleId,
          'DISABLED'
        );
      }

      // Preload dependencies if requested
      if (options.preloadDependencies !== false && config.dependencies) {
        await this.preloadDependencies(config.dependencies);
      }

      // Load the module using Next.js dynamic import
      const loadedModule = await this.dynamicImport<T>(moduleId, options);

      const loadedAt = Date.now();

      return {
        module: loadedModule,
        config,
        loadedAt,
        cached: false,
        size: this.estimateModuleSize(loadedModule),
      };
    } catch (error) {
      throw new ModuleLoadError(
        `Module load failed: ${(error as Error).message}`,
        moduleId,
        'LOAD_FAILED'
      );
    }
  }

  /**
   * Dynamic import using Next.js dynamic()
   */
  private async dynamicImport<T>(
    moduleId: string,
    options: ModuleLoadOptions
  ): Promise<T> {
    try {
      // Build module path
      const modulePath = `/modules/marketplace/${moduleId}`;

      // Create dynamic loader
      const loader: Loader<{ default: T }> = async () => {
        try {
          // Use dynamic import with timeout
          const timeoutMs = options.timeout || 30000;
          const importPromise = import(
            /* webpackChunkName: "[request]" */
            /* webpackMode: "lazy" */
            /* webpackIgnore: true */
            modulePath
          );

          const result = await Promise.race([
            importPromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Module load timeout')),
                timeoutMs
              )
            ),
          ]);

          return result;
        } catch (error) {
          logger.error(`Failed to import module ${moduleId}:`, error);
          throw error;
        }
      };

      // Load module dynamically
      // Note: dynamic() requires SSR option as literal for Next.js static analysis
      const DynamicModule = options.ssr
        ? dynamic<{ default: T }>(loader, { ssr: true })
        : dynamic<{ default: T }>(loader, { ssr: false });

      // For React components, dynamic() returns the component
      if (typeof DynamicModule === 'function') {
        return DynamicModule as unknown as T;
      }

      // Fall back to direct import for non-component exports
      const result = await loader();
      return result as unknown as T;
    } catch (error) {
      throw new ModuleLoadError(
        `Dynamic import failed: ${(error as Error).message}`,
        moduleId,
        'IMPORT_FAILED'
      );
    }
  }

  /**
   * Preload module dependencies
   */
  private async preloadDependencies(dependencies: string[]): Promise<void> {
    const preloadPromises = dependencies.map(async (depId) => {
      try {
        if (!this.cache.has(depId)) {
          await this.loadModule(depId, { cache: true });
        }
      } catch (error) {
        logger.warn(`Failed to preload dependency ${depId}:`, error);
        // Don't throw - dependencies might not be critical
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Unload a module and clean up
   */
  async unloadModule(moduleId: string): Promise<void> {
    try {
      // Emit beforeUninstall event
      await this.emitEvent('beforeUninstall', moduleId);

      // Remove from cache
      this.removeFromCache(moduleId);

      // Cancel any pending loads
      this.loadingPromises.delete(moduleId);

      // Emit afterUninstall event
      await this.emitEvent('afterUninstall', moduleId);

      logger.debug(`✅ Module unloaded: ${moduleId}`);
    } catch (error) {
      logger.error(`Failed to unload module ${moduleId}:`, error);
      throw new ModuleLoadError(
        `Unload failed: ${(error as Error).message}`,
        moduleId,
        'UNLOAD_FAILED'
      );
    }
  }

  /**
   * Get module from cache
   */
  private getFromCache<T>(moduleId: string): ModuleLoadResult<T> | null {
    const entry = this.cache.get(moduleId);

    if (!entry) {
      return null;
    }

    // Check expiration
    const now = Date.now();
    if (now - entry.loadedAt > this.cacheExpirationMs) {
      this.removeFromCache(moduleId);
      return null;
    }

    // Update access info
    entry.lastAccessedAt = now;
    entry.accessCount++;

    return {
      module: entry.module as T,
      config: entry.config,
      loadedAt: entry.loadedAt,
      cached: true,
      size: entry.size,
    };
  }

  /**
   * Add module to cache
   */
  private addToCache<T>(moduleId: string, result: ModuleLoadResult<T>): void {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestCacheEntry();
    }

    const entry: ModuleCacheEntry = {
      moduleId,
      module: result.module,
      config: result.config,
      loadedAt: result.loadedAt,
      lastAccessedAt: result.loadedAt,
      accessCount: 1,
      size: result.size,
    };

    this.cache.set(moduleId, entry);
    logger.debug(`💾 Module cached: ${moduleId}`);
  }

  /**
   * Remove module from cache
   */
  private removeFromCache(moduleId: string): void {
    this.cache.delete(moduleId);
  }

  /**
   * Evict oldest cache entry (LRU)
   */
  private evictOldestCacheEntry(): void {
    let oldestEntry: ModuleCacheEntry | null = null;
    let oldestId: string | null = null;

    for (const [moduleId, entry] of Array.from(this.cache.entries())) {
      if (!oldestEntry || entry.lastAccessedAt < oldestEntry.lastAccessedAt) {
        oldestEntry = entry;
        oldestId = moduleId;
      }
    }

    if (oldestId) {
      this.removeFromCache(oldestId);
      logger.debug(`🗑️  Evicted module from cache: ${oldestId}`);
    }
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('🗑️  Module cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.values());

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      totalAccessCount: entries.reduce((sum, e) => sum + e.accessCount, 0),
      totalSizeBytes: entries.reduce((sum, e) => sum + (e.size || 0), 0),
      entries: entries.map((e) => ({
        moduleId: e.moduleId,
        accessCount: e.accessCount,
        ageMs: Date.now() - e.loadedAt,
        sizeBytes: e.size,
      })),
    };
  }

  /**
   * Estimate module size (rough approximation)
   */
  private estimateModuleSize(module: unknown): number {
    try {
      // Convert to JSON and measure string length
      // This is a rough estimate
      const json = JSON.stringify(module);
      return new Blob([json]).size;
    } catch {
      // If JSON serialization fails, return 0
      return 0;
    }
  }

  /**
   * Register event handler
   */
  on(event: ModuleLifecycleEvent, handler: ModuleLifecycleHandler): void {
    const existingHandlers = this.eventHandlers.get(event);
    if (existingHandlers) {
      existingHandlers.add(handler);
      return;
    }

    this.eventHandlers.set(event, new Set([handler]));
  }

  /**
   * Unregister event handler
   */
  off(event: ModuleLifecycleEvent, handler: ModuleLifecycleHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit lifecycle event
   */
  private async emitEvent(
    event: ModuleLifecycleEvent,
    moduleId: string,
    data?: unknown
  ): Promise<void> {
    const handlers = this.eventHandlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve(handler(moduleId, data)).catch((error) => {
        logger.error(`Event handler error for ${event}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Preload module without instantiating
   */
  async preloadModule(moduleId: string): Promise<void> {
    try {
      const config = moduleRegistry.get(moduleId);

      if (!config) {
        throw new ModuleLoadError(
          `Module not found: ${moduleId}`,
          moduleId,
          'NOT_FOUND'
        );
      }

      // Use browser's link preload
      if (typeof window !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'modulepreload';
        link.href = `/modules/marketplace/${moduleId}`;
        document.head.appendChild(link);
      }

      logger.debug(`🔮 Preloading module: ${moduleId}`);
    } catch (error) {
      logger.warn(`Failed to preload module ${moduleId}:`, error);
    }
  }

  /**
   * Check if module is loaded
   */
  isLoaded(moduleId: string): boolean {
    return this.cache.has(moduleId);
  }

  /**
   * Get all loaded modules
   */
  getLoadedModules(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Configure cache settings
   */
  configureCache(options: { maxSize?: number; expirationMs?: number }): void {
    if (options.maxSize !== undefined) {
      this.maxCacheSize = options.maxSize;
    }
    if (options.expirationMs !== undefined) {
      this.cacheExpirationMs = options.expirationMs;
    }
    logger.debug(`⚙️  Cache configured:`, {
      maxSize: this.maxCacheSize,
      expirationMs: this.cacheExpirationMs,
    });
  }
}

// Singleton instance
export const moduleLoader = new ModuleLoader();

// Export class for testing
export { ModuleLoader };
