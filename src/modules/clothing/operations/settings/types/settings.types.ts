/**
 * Settings Module Types
 *
 * Type definitions for the Settings module including marketplace,
 * installed modules, and module operations.
 */

import type { ModulePackage } from '@/core/ModuleRegistry';

// ============================================================================
// MARKETPLACE TYPES
// ============================================================================

/**
 * Marketplace filter state
 */
export interface MarketplaceFilter {
  searchQuery: string;
  category: string | null;
  sortBy: 'downloads' | 'rating' | 'name' | 'date';
}

/**
 * Module category options
 */
export const MODULE_CATEGORIES = [
  { value: 'operations', label: 'Operations' },
  { value: 'employees', label: 'Employees' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'fleet', label: 'Fleet' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'integration', label: 'Integration' },
  { value: 'utility', label: 'Utility' },
] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number]['value'];

/**
 * Sort options for marketplace
 */
export const SORT_OPTIONS = [
  { value: 'downloads', label: 'Most Downloads' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'date', label: 'Recently Added' },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]['value'];

// ============================================================================
// INSTALLED MODULES TYPES
// ============================================================================

/**
 * Installed module filter state
 */
export interface InstalledModuleFilter {
  searchQuery: string;
  status: 'all' | 'enabled' | 'disabled';
  source: 'all' | 'local' | 'marketplace' | 'npm' | 'git';
}

/**
 * Module status options
 */
export const MODULE_STATUS_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
] as const;

/**
 * Module source options
 */
export const MODULE_SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'local', label: 'Local' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'npm', label: 'NPM' },
  { value: 'git', label: 'Git' },
] as const;

// ============================================================================
// MODULE OPERATIONS TYPES
// ============================================================================

/**
 * Module operation type
 */
export type ModuleOperation =
  | 'install'
  | 'uninstall'
  | 'update'
  | 'enable'
  | 'disable';

/**
 * Module operation status
 */
export interface ModuleOperationStatus {
  moduleId: string;
  operation: ModuleOperation;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  progress?: number;
}

/**
 * Module installation options
 */
export interface ModuleInstallOptions {
  force?: boolean;
  skipDependencies?: boolean;
  version?: string;
}

// ============================================================================
// DEPENDENCY TYPES
// ============================================================================

/**
 * Module dependency node for tree visualization
 */
export interface ModuleDependencyNode {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  dependencies: ModuleDependencyNode[];
  dependents: string[]; // Module IDs that depend on this
}

/**
 * Dependency conflict
 */
export interface DependencyConflict {
  moduleId: string;
  moduleName: string;
  conflictType: 'missing' | 'circular' | 'version-mismatch';
  details: string;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Module statistics
 */
export interface ModuleStatistics {
  totalInstalled: number;
  totalEnabled: number;
  totalDisabled: number;
  totalAvailable: number;
  updatesAvailable: number;
  bySource: {
    local: number;
    marketplace: number;
    npm: number;
    git: number;
  };
}

// ============================================================================
// MODAL DATA TYPES
// ============================================================================

/**
 * Module detail modal data
 */
export interface ModuleDetailModalData {
  module: ModulePackage;
  isInstalled: boolean;
  canUpdate: boolean;
  latestVersion?: string;
}

// ============================================================================
// TAB TYPES
// ============================================================================

/**
 * Settings tab options
 */
export const SETTINGS_TABS = [
  { value: 'invoice', label: 'Invoice Settings', icon: 'file-invoice' },
  { value: 'message', label: 'Templates', icon: 'message' },
  { value: 'transactions', label: 'Transactions', icon: 'table' },
  { value: 'change-log', label: 'Change Log', icon: 'history' },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]['value'];

// ============================================================================
// EXPORT ALL
// ============================================================================

export type { ModulePackage, ModuleUpdateInfo } from '@/core/ModuleRegistry';
