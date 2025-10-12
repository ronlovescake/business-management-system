/**
 * Module System Types - Phase 3
 *
 * TypeScript type definitions for dynamic module loading system
 */

import type { ComponentType, ReactNode } from 'react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

// ============================================================================
// MODULE LOADING TYPES
// ============================================================================

/**
 * Module load options
 */
export interface ModuleLoadOptions {
  /**
   * Load module in SSR mode (default: false)
   */
  ssr?: boolean;

  /**
   * Loading component to show while module loads
   */
  loading?: ComponentType;

  /**
   * Error component to show if module fails to load
   */
  error?: ComponentType<{ error: Error; retry: () => void }>;

  /**
   * Timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Cache the loaded module (default: true)
   */
  cache?: boolean;

  /**
   * Preload module dependencies (default: true)
   */
  preloadDependencies?: boolean;
}

/**
 * Module load result
 */
export interface ModuleLoadResult<T = unknown> {
  /**
   * Loaded module component or export
   */
  module: T;

  /**
   * Module configuration
   */
  config: ModuleConfig;

  /**
   * Load timestamp
   */
  loadedAt: number;

  /**
   * Whether module is cached
   */
  cached: boolean;

  /**
   * Module size in bytes
   */
  size?: number;
}

/**
 * Module cache entry
 */
export interface ModuleCacheEntry {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Loaded module
   */
  module: unknown;

  /**
   * Module config
   */
  config: ModuleConfig;

  /**
   * Load timestamp
   */
  loadedAt: number;

  /**
   * Last accessed timestamp
   */
  lastAccessedAt: number;

  /**
   * Access count
   */
  accessCount: number;

  /**
   * Module size in bytes
   */
  size?: number;
}

// ============================================================================
// MODULE BUNDLING TYPES
// ============================================================================

/**
 * Module bundle format
 */
export type ModuleBundleFormat = 'esm' | 'cjs' | 'umd';

/**
 * Module bundle
 */
export interface ModuleBundle {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Module version
   */
  version: string;

  /**
   * Bundle format
   */
  format: ModuleBundleFormat;

  /**
   * Bundle code
   */
  code: string;

  /**
   * Source map
   */
  sourceMap?: string;

  /**
   * Bundle size in bytes
   */
  size: number;

  /**
   * Bundle checksum (SHA-256)
   */
  checksum: string;

  /**
   * Bundle timestamp
   */
  bundledAt: number;

  /**
   * Entry point
   */
  entryPoint: string;

  /**
   * Included files
   */
  files: string[];

  /**
   * External dependencies
   */
  externals: string[];
}

/**
 * Bundle validation result
 */
export interface BundleValidationResult {
  /**
   * Whether bundle is valid
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: string[];

  /**
   * Validation warnings
   */
  warnings: string[];

  /**
   * Checksum match
   */
  checksumValid?: boolean;

  /**
   * Size within limits
   */
  sizeValid?: boolean;

  /**
   * All dependencies present
   */
  dependenciesValid?: boolean;
}

// ============================================================================
// MODULE PERMISSIONS & SANDBOXING TYPES
// ============================================================================

/**
 * Module permission type
 */
export type ModulePermissionType =
  | 'database.read'
  | 'database.write'
  | 'database.delete'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'filesystem.delete'
  | 'files.read'
  | 'files.write'
  | 'files.delete'
  | 'network.fetch'
  | 'network.websocket'
  | 'network.internal'
  | 'network.external'
  | 'storage.local'
  | 'storage.session'
  | 'storage.cookie'
  | 'ui.render'
  | 'ui.navigation'
  | 'ui.notification'
  | 'ui.modal'
  | 'system.process'
  | 'system.environment';

/**
 * Module permissions
 */
export interface ModulePermissions {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Granted permissions
   */
  granted: ModulePermissionType[];

  /**
   * Denied permissions
   */
  denied: ModulePermissionType[];

  /**
   * Whether module can access database
   */
  canAccessDatabase: boolean;

  /**
   * Whether module can access file system
   */
  canAccessFileSystem: boolean;

  /**
   * Whether module can make network requests
   */
  canMakeNetworkRequests: boolean;

  /**
   * Allowed API endpoints (glob patterns)
   */
  allowedAPIs: string[];

  /**
   * Allowed database tables
   */
  allowedTables?: string[];

  /**
   * Resource limits
   */
  limits?: ModuleResourceLimits;
}

/**
 * Module resource limits
 */
export interface ModuleResourceLimits {
  /**
   * Max memory usage in MB
   */
  maxMemoryMB?: number;

  /**
   * Max execution time in ms
   */
  maxExecutionMs?: number;

  /**
   * Max API calls per minute
   */
  maxApiCallsPerMinute?: number;

  /**
   * Max file size in MB
   */
  maxFileSizeMB?: number;

  /**
   * Max concurrent operations
   */
  maxConcurrentOperations?: number;
}

/**
 * Module sandbox context
 */
export interface ModuleSandboxContext {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Module permissions
   */
  permissions: ModulePermissions;

  /**
   * Isolated module scope
   */
  scope: Record<string, unknown>;

  /**
   * API proxy for controlled access
   */
  api: ModuleAPIProxy;

  /**
   * Resource usage tracking
   */
  resources: ModuleResourceUsage;
}

/**
 * Module permission request
 */
export interface ModulePermissionRequest {
  /**
   * Permission being requested
   */
  permission: ModulePermissionType;

  /**
   * Reason for request
   */
  reason?: string;

  /**
   * Whether user has approved
   */
  userApproval?: boolean;
}

/**
 * Module permission grant result
 */
export interface ModulePermissionGrant {
  /**
   * Whether permission was granted
   */
  granted: boolean;

  /**
   * Permission type
   */
  permission: ModulePermissionType;

  /**
   * Module ID
   */
  moduleId: string;

  /**
   * When granted
   */
  grantedAt?: number;

  /**
   * Reason for denial
   */
  reason?: string;
}

/**
 * Module sandbox configuration
 */
export interface ModuleSandboxConfig {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Whether module is isolated
   */
  isolated: boolean;

  /**
   * Granted permissions
   */
  permissions: ModulePermissionType[];

  /**
   * Resource limits
   */
  limits: {
    maxMemoryMB?: number;
    maxCPUPercent?: number;
    maxStorageMB?: number;
    maxNetworkRequests?: number;
  };
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  /**
   * Memory usage in MB
   */
  memoryMB: number;

  /**
   * CPU usage percentage
   */
  cpuPercent: number;

  /**
   * Storage usage in MB
   */
  storageMB: number;

  /**
   * Number of network requests
   */
  networkRequests: number;

  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Module API proxy
 */
export interface ModuleAPIProxy {
  /**
   * Fetch with permission check
   */
  fetch: (url: string, options?: RequestInit) => Promise<Response>;

  /**
   * Database query with permission check
   */
  query: <T>(query: string, params?: unknown[]) => Promise<T>;

  /**
   * Storage access with permission check
   */
  storage: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };

  /**
   * Navigation with permission check
   */
  navigate: (path: string) => void;

  /**
   * Notification with permission check
   */
  notify: (message: string, options?: NotificationOptions) => void;
}

/**
 * Module resource usage
 */
export interface ModuleResourceUsage {
  /**
   * Memory usage in bytes
   */
  memoryBytes: number;

  /**
   * API calls count
   */
  apiCalls: number;

  /**
   * Execution time in ms
   */
  executionMs: number;

  /**
   * File operations count
   */
  fileOperations: number;

  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

// ============================================================================
// MODULE DOWNLOAD & EXTRACTION TYPES
// ============================================================================

/**
 * Module download status
 */
export type ModuleDownloadStatus =
  | 'pending'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'installing'
  | 'complete'
  | 'failed';

/**
 * Module download progress
 */
export interface ModuleDownloadProgress {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Current status
   */
  status: ModuleDownloadStatus;

  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Downloaded bytes
   */
  downloadedBytes: number;

  /**
   * Total bytes
   */
  totalBytes: number;

  /**
   * Current step message
   */
  message: string;

  /**
   * Error if failed
   */
  error?: string;

  /**
   * Started timestamp
   */
  startedAt: number;

  /**
   * Completed timestamp
   */
  completedAt?: number;
}

/**
 * Module extraction result
 */
export interface ModuleExtractionResult {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Installation path
   */
  installPath: string;

  /**
   * Extracted files
   */
  files: string[];

  /**
   * Total size in bytes
   */
  totalSize: number;

  /**
   * Extraction duration in ms
   */
  durationMs: number;

  /**
   * Whether extraction succeeded
   */
  success: boolean;

  /**
   * Errors if any
   */
  errors?: string[];
}

// ============================================================================
// HOT MODULE RELOADING TYPES
// ============================================================================

/**
 * HMR update type
 */
export type HMRUpdateType = 'full' | 'partial' | 'assets';

/**
 * HMR update
 */
export interface HMRUpdate {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Update type
   */
  type: HMRUpdateType;

  /**
   * Previous version
   */
  previousVersion: string;

  /**
   * New version
   */
  newVersion: string;

  /**
   * Changed files
   */
  changedFiles: string[];

  /**
   * Update timestamp
   */
  timestamp: number;

  /**
   * Whether state should be preserved
   */
  preserveState: boolean;
}

/**
 * HMR result
 */
export interface HMRResult {
  /**
   * Module ID
   */
  moduleId: string;

  /**
   * Whether reload succeeded
   */
  success: boolean;

  /**
   * Previous version
   */
  previousVersion: string;

  /**
   * New version
   */
  newVersion: string;

  /**
   * Reload duration in ms
   */
  durationMs: number;

  /**
   * Errors if any
   */
  errors?: string[];

  /**
   * Whether state was preserved
   */
  statePreserved: boolean;
}

// ============================================================================
// MODULE LIFECYCLE TYPES
// ============================================================================

/**
 * Module lifecycle event type
 */
export type ModuleLifecycleEvent =
  | 'beforeInstall'
  | 'afterInstall'
  | 'beforeLoad'
  | 'afterLoad'
  | 'beforeUninstall'
  | 'afterUninstall'
  | 'beforeReload'
  | 'afterReload'
  | 'error';

/**
 * Module lifecycle handler
 */
export type ModuleLifecycleHandler = (
  moduleId: string,
  data?: unknown
) => void | Promise<void>;

/**
 * Module event bus
 */
export interface ModuleEventBus {
  /**
   * Register lifecycle event handler
   */
  on: (event: ModuleLifecycleEvent, handler: ModuleLifecycleHandler) => void;

  /**
   * Unregister lifecycle event handler
   */
  off: (event: ModuleLifecycleEvent, handler: ModuleLifecycleHandler) => void;

  /**
   * Emit lifecycle event
   */
  emit: (
    event: ModuleLifecycleEvent,
    moduleId: string,
    data?: unknown
  ) => Promise<void>;
}

// ============================================================================
// MODULE CONTAINER TYPES
// ============================================================================

/**
 * Module container props
 */
export interface ModuleContainerProps {
  /**
   * Module ID to load
   */
  moduleId: string;

  /**
   * Load options
   */
  options?: ModuleLoadOptions;

  /**
   * Props to pass to loaded module
   */
  moduleProps?: Record<string, unknown>;

  /**
   * Fallback component
   */
  fallback?: ReactNode;

  /**
   * Error handler
   */
  onError?: (error: Error) => void;

  /**
   * Load handler
   */
  onLoad?: (module: ModuleLoadResult) => void;
}

/**
 * Module container state
 */
export interface ModuleContainerState {
  /**
   * Loading status
   */
  loading: boolean;

  /**
   * Error if failed
   */
  error?: Error;

  /**
   * Loaded module
   */
  module?: ModuleLoadResult;

  /**
   * Retry count
   */
  retryCount: number;
}

// ============================================================================
// NOTIFICATION OPTIONS (for API proxy)
// ============================================================================

/**
 * Notification options
 */
export interface NotificationOptions {
  /**
   * Notification type
   */
  type?: 'success' | 'error' | 'warning' | 'info';

  /**
   * Auto-close duration in ms
   */
  autoClose?: number;

  /**
   * Position
   */
  position?:
    | 'top-left'
    | 'top-right'
    | 'top-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'bottom-center';
}
