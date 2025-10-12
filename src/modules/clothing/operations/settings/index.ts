/**
 * Settings Module Public API
 *
 * Central export point for Settings module
 */

// =============================================================================
// MODULE CONFIGURATION
// =============================================================================

export { settingsModule } from './module.config';

// =============================================================================
// TYPES
// =============================================================================

export type {
  MarketplaceFilter,
  ModuleCategory,
  SortOption,
  InstalledModuleFilter,
  ModuleOperation,
  ModuleOperationStatus,
  ModuleInstallOptions,
  ModuleDependencyNode,
  DependencyConflict,
  ModuleStatistics,
  ModuleDetailModalData,
  SettingsTab,
  ModulePackage,
  ModuleUpdateInfo,
} from './types';

export {
  MODULE_CATEGORIES,
  SORT_OPTIONS,
  MODULE_STATUS_OPTIONS,
  MODULE_SOURCE_OPTIONS,
  SETTINGS_TABS,
} from './types';

// =============================================================================
// HOOKS
// =============================================================================

export { useModuleMarketplace } from './hooks';
export { useInstalledModules } from './hooks';
export { useModuleOperations } from './hooks';

// =============================================================================
// COMPONENTS
// =============================================================================

export { SettingsPage } from './components';
export { ModuleCard } from './components';
export { MarketplaceTab } from './components';
export { InstalledModulesTab } from './components';
export { UpdatesTab } from './components';
export { DependenciesTab } from './components';
