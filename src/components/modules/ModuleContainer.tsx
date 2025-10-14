/**
 * ModuleContainer - Dynamic Module Rendering Component
 *
 * This component handles:
 * - Dynamic module loading and rendering
 * - Loading states and error boundaries
 * - Module lifecycle management
 * - Hot module replacement integration
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { moduleLoader } from '@/core/ModuleLoader';
import { moduleHMR } from '@/core/ModuleHMR';
import { moduleSandbox } from '@/core/ModuleSandbox';
import type { ComponentType } from 'react';
import type { ModuleLoadResult } from '@/types/module-system';
import { logger } from '@/lib/logger';

// ============================================================================
// COMPONENT TYPES
// ============================================================================

export interface ModuleContainerProps {
  /**
   * Module ID to load
   */
  moduleId: string;

  /**
   * Optional loading fallback
   */
  fallback?: React.ReactNode;

  /**
   * Optional error fallback
   */
  errorFallback?: React.ReactNode | ((error: Error) => React.ReactNode);

  /**
   * Props to pass to loaded module
   */
  moduleProps?: Record<string, unknown>;

  /**
   * Enable HMR
   */
  enableHMR?: boolean;

  /**
   * Sandbox configuration
   */
  enableSandbox?: boolean;

  /**
   * Callback when module loads
   */
  onLoad?: (result: ModuleLoadResult) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

interface ModuleContainerState {
  loading: boolean;
  error: Error | null;
  module: ComponentType | null;
  loadTime: number | null;
}

// ============================================================================
// MODULE CONTAINER COMPONENT
// ============================================================================

export function ModuleContainer({
  moduleId,
  fallback = <ModuleLoadingFallback moduleId={moduleId} />,
  errorFallback,
  moduleProps = {},
  enableHMR = true,
  enableSandbox = true,
  onLoad,
  onError,
}: ModuleContainerProps): JSX.Element {
  const [state, setState] = useState<ModuleContainerState>({
    loading: true,
    error: null,
    module: null,
    loadTime: null,
  });

  /**
   * Load the module
   */
  const loadModule = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      logger.debug(`📦 Loading module: ${moduleId}`);
      const startTime = Date.now();

      // Initialize sandbox if enabled
      if (enableSandbox) {
        await moduleSandbox.initializeSandbox(moduleId, {
          isolated: true,
          permissions: ['ui.render', 'ui.notification'],
        });
      }

      // Load the module
      const result = await moduleLoader.loadModule<ComponentType>(moduleId, {
        cache: true,
        preloadDependencies: true,
        timeout: 30000,
      });

      const loadTime = Date.now() - startTime;

      setState({
        loading: false,
        error: null,
        module: result.module,
        loadTime,
      });

      logger.debug(`✅ Module loaded: ${moduleId} (${loadTime}ms)`);

      // Call onLoad callback
      onLoad?.(result);
    } catch (error) {
      const err = error as Error;
      logger.error(`❌ Module load failed: ${moduleId}`, err);

      setState({
        loading: false,
        error: err,
        module: null,
        loadTime: null,
      });

      // Call onError callback
      onError?.(err);
    }
  }, [moduleId, enableSandbox, onLoad, onError]);

  /**
   * Setup HMR if enabled
   */
  useEffect(() => {
    if (!enableHMR) {
      return;
    }

    const handleAfterReload = (reloadedModuleId: string) => {
      if (reloadedModuleId === moduleId) {
        logger.debug(`🔄 Reloading module container: ${moduleId}`);
        loadModule();
      }
    };

    moduleHMR.on('afterReload', handleAfterReload);

    return () => {
      moduleHMR.off('afterReload', handleAfterReload);
    };
  }, [moduleId, enableHMR, loadModule]);

  /**
   * Load module on mount
   */
  useEffect(() => {
    loadModule();
  }, [loadModule]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (enableSandbox) {
        moduleSandbox.destroySandbox(moduleId);
      }
    };
  }, [moduleId, enableSandbox]);

  // Render loading state
  if (state.loading) {
    return <>{fallback}</>;
  }

  // Render error state
  if (state.error) {
    if (errorFallback) {
      return (
        <>
          {typeof errorFallback === 'function'
            ? errorFallback(state.error)
            : errorFallback}
        </>
      );
    }

    return <ModuleErrorFallback error={state.error} moduleId={moduleId} />;
  }

  // Render module
  if (state.module) {
    const ModuleComponent = state.module;

    return (
      <ModuleErrorBoundary moduleId={moduleId} onError={onError}>
        <ModuleComponent {...moduleProps} />
      </ModuleErrorBoundary>
    );
  }

  // Shouldn't reach here, but handle gracefully
  return <div>Module not loaded</div>;
}

// ============================================================================
// DEFAULT FALLBACK COMPONENTS
// ============================================================================

/**
 * Default loading fallback
 */
function ModuleLoadingFallback({
  moduleId,
}: {
  moduleId: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading module: {moduleId}</p>
      </div>
    </div>
  );
}

/**
 * Default error fallback
 */
function ModuleErrorFallback({
  error,
  moduleId,
}: {
  error: Error;
  moduleId: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Module Load Error
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          Failed to load module: <code className="font-mono">{moduleId}</code>
        </p>
        <p className="text-sm text-gray-500 font-mono bg-gray-100 p-2 rounded">
          {error.message}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

/**
 * Error boundary for module rendering
 */
class ModuleErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    moduleId: string;
    onError?: (error: Error) => void;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: {
    children: React.ReactNode;
    moduleId: string;
    onError?: (error: Error) => void;
  }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): {
    hasError: boolean;
    error: Error;
  } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error(
      `Module render error (${this.props.moduleId}):`,
      error,
      errorInfo
    );
    this.props.onError?.(error);
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <ModuleErrorFallback
          error={this.state.error}
          moduleId={this.props.moduleId}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ModuleContainer;
