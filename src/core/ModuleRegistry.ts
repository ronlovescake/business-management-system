/**
 * Module Registry - Dynamic Module Management System
 *
 * This registry allows you to:
 * - Register modules dynamically
 * - Generate routes automatically
 * - Build navigation from modules
 * - Enable/disable features via config
 * - Install/uninstall modules (plugin system)
 */

import type { ComponentType } from 'react';
import { logger } from '@/lib/logger';

export type IconComponent = ComponentType<{ size?: number; stroke?: number }>;

export interface ModuleRoute {
  path: string;
  component: () => Promise<{ default: ComponentType }>;
  protected?: boolean;
}

export interface ModuleNavigation {
  label: string;
  icon: IconComponent;
  path: string;
  order: number;
  workspace?: ('operations' | 'employees' | 'expenses')[];
  business?: ('clothing' | 'trucking')[];
}

export interface ModuleConfig {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  dependencies?: string[];
  routes?: ModuleRoute[];
  navigation?: ModuleNavigation[];
  permissions?: string[];
  metadata?: {
    description?: string;
    author?: string;
    tags?: string[];
  };
}

// ============================================================================
// PLUGIN SYSTEM TYPES
// ============================================================================

/**
 * Module source type
 */
export type ModuleSource = 'local' | 'npm' | 'git' | 'marketplace';

/**
 * Module author information
 */
export interface ModuleAuthor {
  name: string;
  email: string;
  url?: string;
}

/**
 * Extended module configuration for plugin system
 */
export interface ModulePackage extends ModuleConfig {
  source?: ModuleSource;
  downloadUrl?: string;
  installPath?: string;
  size?: number;
  downloads?: number;
  rating?: number;
  screenshots?: string[];
  repository?: string;
  license?: string;
  author?: ModuleAuthor;
  keywords?: string[];
  checksum?: string; // SHA-256 checksum for download verification
  peerDependencies?: Record<string, string>;
  bundledDependencies?: string[];
}

/**
 * Options for module installation
 */
export interface ModuleInstallOptions {
  force?: boolean;
  skipDependencies?: boolean;
  version?: string;
}

/**
 * Module marketplace manifest
 */
export interface ModuleManifest {
  modules: ModulePackage[];
  lastUpdated: string;
  version: string;
}

/**
 * Module update information
 */
export interface ModuleUpdateInfo {
  module: ModuleConfig;
  currentVersion: string;
  latestVersion: string;
  changelog?: string;
}

/**
 * Module validation result
 */
export interface ModuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class ModuleRegistry {
  private modules = new Map<string, ModuleConfig>();
  private initialized = false;

  /**
   * Register a new module
   */
  register(module: ModuleConfig): void {
    // Validate dependencies
    if (module.dependencies) {
      this.validateDependencies(module.dependencies);
    }

    this.modules.set(module.id, module);
    logger.debug(`✅ Module registered: ${module.name} (v${module.version})`);
  }

  /**
   * Unregister a module
   */
  unregister(moduleId: string): void {
    const moduleConfig = this.modules.get(moduleId);
    if (moduleConfig) {
      this.modules.delete(moduleId);
      logger.debug(`❌ Module unregistered: ${moduleConfig.name}`);
    }
  }

  /**
   * Get a specific module
   */
  get(moduleId: string): ModuleConfig | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Get all registered modules
   */
  getAll(): ModuleConfig[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get only enabled modules
   */
  getEnabled(): ModuleConfig[] {
    return this.getAll().filter((m) => m.enabled);
  }

  /**
   * Get modules for specific business and workspace
   */
  getForContext(
    business: 'clothing' | 'trucking',
    workspace: 'operations' | 'employees' | 'expenses'
  ): ModuleConfig[] {
    return this.getEnabled().filter((module) => {
      const navItems = module.navigation || [];
      return navItems.some(
        (nav) =>
          (!nav.business || nav.business.includes(business)) &&
          (!nav.workspace || nav.workspace.includes(workspace))
      );
    });
  }

  /**
   * Generate navigation items for sidebar
   */
  getNavigation(
    business: 'clothing' | 'trucking',
    workspace: 'operations' | 'employees' | 'expenses'
  ): ModuleNavigation[] {
    const modules = this.getForContext(business, workspace);

    const navItems = modules
      .flatMap((m) => m.navigation || [])
      .filter(
        (nav) =>
          (!nav.business || nav.business.includes(business)) &&
          (!nav.workspace || nav.workspace.includes(workspace))
      )
      .sort((a, b) => a.order - b.order);

    return navItems;
  }

  /**
   * Generate routes for Next.js
   */
  getRoutes(): ModuleRoute[] {
    return this.getEnabled().flatMap((m) => m.routes || []);
  }

  /**
   * Check if module is enabled
   */
  isEnabled(moduleId: string): boolean {
    const moduleConfig = this.modules.get(moduleId);
    return moduleConfig?.enabled ?? false;
  }

  /**
   * Enable/disable a module
   */
  setEnabled(moduleId: string, enabled: boolean): void {
    const moduleConfig = this.modules.get(moduleId);
    if (moduleConfig) {
      moduleConfig.enabled = enabled;
      logger.debug(
        `${enabled ? '✅' : '❌'} Module ${enabled ? 'enabled' : 'disabled'}: ${moduleConfig.name}`
      );
    }
  }

  /**
   * Validate module dependencies
   */
  private validateDependencies(deps: string[]): void {
    for (const dep of deps) {
      if (!this.modules.has(dep)) {
        logger.warn(`⚠️  Missing dependency: ${dep}`);
      }
    }
  }

  /**
   * Initialize all modules
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('⚠️  Module registry already initialized');
      return;
    }

    logger.debug('🚀 Initializing module registry...');
    this.initialized = true;
    logger.debug(`✅ ${this.modules.size} modules registered`);
  }

  /**
   * Get module statistics
   */
  getStats() {
    const all = this.getAll();
    const enabled = this.getEnabled();

    return {
      total: all.length,
      enabled: enabled.length,
      disabled: all.length - enabled.length,
      withRoutes: enabled.filter((m) => m.routes && m.routes.length > 0).length,
      withNavigation: enabled.filter(
        (m) => m.navigation && m.navigation.length > 0
      ).length,
    };
  }
}

// Singleton instance
export const moduleRegistry = new ModuleRegistry();
