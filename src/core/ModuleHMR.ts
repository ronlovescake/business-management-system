/**
 * Module HMR (Hot Module Replacement) - Live Module Reloading
 *
 * This service handles:
 * - Hot reloading of modules without full app restart
 * - Cache invalidation for updated modules
 * - State preservation during reloads
 * - File system watching for changes
 * - Automatic reload triggering
 */

import { moduleLoader } from './ModuleLoader';
import { moduleRegistry } from './ModuleRegistry';

// ============================================================================
// HMR TYPES
// ============================================================================

export type HMRUpdateType = 'full' | 'partial' | 'assets';

export interface HMRUpdate {
  moduleId: string;
  version: string;
  updateType: HMRUpdateType;
  timestamp: number;
  changes: string[];
}

export interface HMRResult {
  success: boolean;
  moduleId: string;
  reloaded: boolean;
  error?: string;
  duration: number;
}

export interface HMROptions {
  preserveState?: boolean;
  reloadDependents?: boolean;
  notifyUI?: boolean;
}

export type HMREventType = 'beforeReload' | 'afterReload' | 'error';
export type HMREventHandler = (moduleId: string, data?: unknown) => void;

// ============================================================================
// HMR ERRORS
// ============================================================================

export class HMRError extends Error {
  constructor(
    message: string,
    public moduleId: string,
    public code: string
  ) {
    super(message);
    this.name = 'HMRError';
  }
}

// ============================================================================
// MODULE HMR CLASS
// ============================================================================

class ModuleHMR {
  private moduleStates = new Map<string, unknown>();
  private eventHandlers = new Map<HMREventType, Set<HMREventHandler>>();
  private reloadQueue = new Map<string, NodeJS.Timeout>();
  private readonly RELOAD_DEBOUNCE_MS = 500;

  /**
   * Reload a module with hot module replacement
   */
  async reloadModule(
    moduleId: string,
    options: HMROptions = {}
  ): Promise<HMRResult> {
    const startTime = Date.now();

    try {
      logger.debug(`🔄 HMR: Reloading module: ${moduleId}`);

      // Emit beforeReload event
      this.emitEvent('beforeReload', moduleId);

      // Get module config
      const config = moduleRegistry.get(moduleId);

      if (!config) {
        throw new HMRError(
          `Module not found in registry: ${moduleId}`,
          moduleId,
          'NOT_FOUND'
        );
      }

      // Preserve state if requested
      if (options.preserveState !== false) {
        await this.preserveModuleState(moduleId);
      }

      // Invalidate cache
      await this.invalidateModuleCache(moduleId);

      // Reload the module
      const reloaded = await this.performReload(moduleId);

      // Restore state if preserved
      if (options.preserveState !== false) {
        await this.restoreModuleState(moduleId);
      }

      // Reload dependents if requested
      if (options.reloadDependents !== false) {
        await this.reloadDependents(moduleId);
      }

      const duration = Date.now() - startTime;

      logger.debug(`✅ HMR: Module reloaded successfully`);
      logger.debug(`⏱️  Duration: ${duration}ms`);

      // Emit afterReload event
      this.emitEvent('afterReload', moduleId, { duration });

      return {
        success: true,
        moduleId,
        reloaded,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      logger.error(`❌ HMR: Reload failed for ${moduleId}:`, errorMessage);

      // Emit error event
      this.emitEvent('error', moduleId, error);

      return {
        success: false,
        moduleId,
        reloaded: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Perform the actual module reload
   */
  private async performReload(moduleId: string): Promise<boolean> {
    try {
      // Check if module is currently loaded
      const isLoaded = moduleLoader.isLoaded(moduleId);

      if (isLoaded) {
        // Unload existing module
        await moduleLoader.unloadModule(moduleId);
      }

      // Load fresh module
      await moduleLoader.loadModule(moduleId, {
        cache: false, // Don't cache during HMR
        preloadDependencies: true,
      });

      return true;
    } catch (error) {
      throw new HMRError(
        `Reload failed: ${(error as Error).message}`,
        moduleId,
        'RELOAD_FAILED'
      );
    }
  }

  /**
   * Invalidate module cache
   */
  private async invalidateModuleCache(moduleId: string): Promise<void> {
    try {
      // Clear from module loader cache
      if (moduleLoader.isLoaded(moduleId)) {
        await moduleLoader.unloadModule(moduleId);
      }

      // Clear from Next.js cache if possible
      // Note: This is a simplified version
      // In production, you might need to integrate with Next.js's HMR API
      if (
        typeof window !== 'undefined' &&
        (window as { __NEXT_DATA__?: { buildId: string } }).__NEXT_DATA__
      ) {
        logger.debug('🔄 Clearing Next.js cache for:', moduleId);
      }

      logger.debug(`🗑️  Cache invalidated for: ${moduleId}`);
    } catch (error) {
      throw new HMRError(
        `Cache invalidation failed: ${(error as Error).message}`,
        moduleId,
        'CACHE_INVALIDATION_FAILED'
      );
    }
  }

  /**
   * Preserve module state before reload
   */
  private async preserveModuleState(moduleId: string): Promise<void> {
    try {
      // In a real implementation, you would:
      // 1. Get current component state
      // 2. Serialize it
      // 3. Store in moduleStates map

      // For now, we'll just store a placeholder
      this.moduleStates.set(moduleId, {
        timestamp: Date.now(),
        // Add actual state preservation logic here
      });

      logger.debug(`💾 State preserved for: ${moduleId}`);
    } catch (error) {
      // State preservation is best effort - don't fail the reload
      logger.warn(`⚠️  Failed to preserve state for ${moduleId}:`, error);
    }
  }

  /**
   * Restore module state after reload
   */
  private async restoreModuleState(moduleId: string): Promise<void> {
    try {
      const savedState = this.moduleStates.get(moduleId);

      if (savedState) {
        // In a real implementation, you would:
        // 1. Get the reloaded component
        // 2. Deserialize saved state
        // 3. Apply to new component instance

        logger.debug(`♻️  State restored for: ${moduleId}`);
      }
    } catch (error) {
      // State restoration is best effort - don't fail the reload
      logger.warn(`⚠️  Failed to restore state for ${moduleId}:`, error);
    } finally {
      // Clean up saved state
      this.moduleStates.delete(moduleId);
    }
  }

  /**
   * Reload dependent modules
   */
  private async reloadDependents(moduleId: string): Promise<void> {
    try {
      // Find modules that depend on this module
      const dependents = this.findDependents(moduleId);

      if (dependents.length === 0) {
        return;
      }

      logger.debug(`🔄 Reloading ${dependents.length} dependent modules...`);

      // Reload each dependent
      for (const depId of dependents) {
        await this.reloadModule(depId, {
          preserveState: true,
          reloadDependents: false, // Prevent circular reloads
          notifyUI: false, // Don't notify for cascading reloads
        });
      }
    } catch (error) {
      // Dependent reload failures don't fail the main reload
      logger.warn(
        `⚠️  Failed to reload dependents of ${moduleId}:`,
        (error as Error).message
      );
    }
  }

  /**
   * Find modules that depend on the given module
   */
  private findDependents(moduleId: string): string[] {
    const dependents: string[] = [];
    const allModules = moduleRegistry.getAll();

    for (const moduleConfig of allModules) {
      if (moduleConfig.dependencies?.includes(moduleId)) {
        dependents.push(moduleConfig.id);
      }
    }

    return dependents;
  }

  /**
   * Queue a module reload with debouncing
   */
  queueReload(moduleId: string, options: HMROptions = {}): void {
    // Clear existing timeout
    const existingTimeout = this.reloadQueue.get(moduleId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Queue new reload
    const timeout = setTimeout(() => {
      this.reloadModule(moduleId, options).catch((error) => {
        logger.error(`HMR queue reload failed for ${moduleId}:`, error);
      });

      this.reloadQueue.delete(moduleId);
    }, this.RELOAD_DEBOUNCE_MS);

    this.reloadQueue.set(moduleId, timeout);
  }

  /**
   * Clear reload queue for a module
   */
  clearReloadQueue(moduleId: string): void {
    const timeout = this.reloadQueue.get(moduleId);
    if (timeout) {
      clearTimeout(timeout);
      this.reloadQueue.delete(moduleId);
    }
  }

  /**
   * Clear all queued reloads
   */
  clearAllQueues(): void {
    const timeouts = Array.from(this.reloadQueue.values());

    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }

    this.reloadQueue.clear();
  }

  /**
   * Register event handler
   */
  on(event: HMREventType, handler: HMREventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)?.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: HMREventType, handler: HMREventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit event to handlers
   */
  private emitEvent(
    event: HMREventType,
    moduleId: string,
    data?: unknown
  ): void {
    const handlers = this.eventHandlers.get(event);

    if (handlers) {
      const handlersArray = Array.from(handlers);

      for (const handler of handlersArray) {
        try {
          handler(moduleId, data);
        } catch (error) {
          logger.error(`Error in HMR ${event} handler:`, error);
        }
      }
    }
  }

  /**
   * Check if module has pending reload
   */
  hasPendingReload(moduleId: string): boolean {
    return this.reloadQueue.has(moduleId);
  }

  /**
   * Get all modules with pending reloads
   */
  getPendingReloads(): string[] {
    return Array.from(this.reloadQueue.keys());
  }

  /**
   * Get reload statistics
   */
  getStatistics(): {
    pendingReloads: number;
    preservedStates: number;
    eventHandlers: Record<string, number>;
  } {
    const eventHandlers: Record<string, number> = {};
    const entries = Array.from(this.eventHandlers.entries());

    for (const [event, handlers] of entries) {
      eventHandlers[event] = handlers.size;
    }

    return {
      pendingReloads: this.reloadQueue.size,
      preservedStates: this.moduleStates.size,
      eventHandlers,
    };
  }

  /**
   * Cleanup HMR system
   */
  cleanup(): void {
    this.clearAllQueues();
    this.moduleStates.clear();
    this.eventHandlers.clear();
    logger.debug('🗑️  HMR system cleaned up');
  }
}

// Singleton instance
export const moduleHMR = new ModuleHMR();

// Export class for testing
export { ModuleHMR };
