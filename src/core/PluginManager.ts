/**
 * Plugin Manager - Dynamic Module Installation and Management
 *
 * This manager allows you to:
 * - Install modules dynamically from marketplace
 * - Uninstall modules safely
 * - Update modules to latest versions
 * - Manage module dependencies
 * - Validate module integrity
 */

import { moduleRegistry } from './ModuleRegistry';
import type {
  ModulePackage,
  ModuleInstallOptions,
  ModuleManifest,
  ModuleUpdateInfo,
  ModuleValidationResult,
} from './ModuleRegistry';

// ============================================================================
// PLUGIN MANAGER ERRORS
// ============================================================================

export class PluginError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export class DependencyError extends PluginError {
  constructor(message: string) {
    super(message, 'DEPENDENCY_ERROR');
    this.name = 'DependencyError';
  }
}

export class ValidationError extends PluginError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class DownloadError extends PluginError {
  constructor(message: string) {
    super(message, 'DOWNLOAD_ERROR');
    this.name = 'DownloadError';
  }
}

// ============================================================================
// PLUGIN MANAGER CLASS
// ============================================================================

class PluginManager {
  private installedModules = new Map<string, ModulePackage>();
  private marketplace: ModulePackage[] = [];
  private initialized = false;

  /**
   * Initialize the plugin manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('⚠️  Plugin manager already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing plugin manager...');

      // Load installed modules from database
      await this.loadInstalledModules();

      this.initialized = true;
      console.log(
        `✅ Plugin manager initialized with ${this.installedModules.size} modules`
      );
    } catch (error) {
      console.error('❌ Failed to initialize plugin manager:', error);
      throw new PluginError(
        'Failed to initialize plugin manager',
        'INIT_ERROR'
      );
    }
  }

  /**
   * Load marketplace catalog from remote source
   */
  async fetchMarketplace(): Promise<ModulePackage[]> {
    try {
      const response = await fetch('/api/marketplace/modules');

      if (!response.ok) {
        throw new DownloadError(
          `Failed to fetch marketplace: ${response.statusText}`
        );
      }

      const manifest: ModuleManifest = await response.json();
      this.marketplace = manifest.modules;

      console.log(
        `✅ Loaded ${this.marketplace.length} modules from marketplace`
      );
      return this.marketplace;
    } catch (error) {
      if (error instanceof PluginError) throw error;
      throw new DownloadError(
        `Failed to fetch marketplace: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get all available modules from marketplace
   */
  getMarketplace(): ModulePackage[] {
    return this.marketplace;
  }

  /**
   * Search marketplace modules
   */
  searchMarketplace(query: string): ModulePackage[] {
    const lowercaseQuery = query.toLowerCase();

    return this.marketplace.filter((module) => {
      const nameMatch = module.name.toLowerCase().includes(lowercaseQuery);
      const descMatch = module.metadata?.description
        ?.toLowerCase()
        .includes(lowercaseQuery);
      const tagMatch = module.metadata?.tags?.some((tag) =>
        tag.toLowerCase().includes(lowercaseQuery)
      );
      const keywordMatch = module.keywords?.some((keyword) =>
        keyword.toLowerCase().includes(lowercaseQuery)
      );

      return nameMatch || descMatch || tagMatch || keywordMatch;
    });
  }

  /**
   * Install a module dynamically
   */
  async installModule(
    moduleId: string,
    options: ModuleInstallOptions = {}
  ): Promise<void> {
    try {
      console.log(`📦 Installing module: ${moduleId}`);

      // Find module in marketplace
      const moduleToInstall = this.marketplace.find((m) => m.id === moduleId);
      if (!moduleToInstall) {
        throw new PluginError(
          `Module ${moduleId} not found in marketplace`,
          'NOT_FOUND'
        );
      }

      // Check if already installed
      if (this.installedModules.has(moduleId) && !options.force) {
        throw new PluginError(
          `Module ${moduleId} is already installed`,
          'ALREADY_INSTALLED'
        );
      }

      // 1. Validate module
      const validation = await this.validateModule(moduleToInstall);
      if (!validation.valid) {
        throw new ValidationError(
          `Module validation failed: ${validation.errors.join(', ')}`
        );
      }

      // 2. Check and install dependencies
      if (!options.skipDependencies) {
        await this.checkAndInstallDependencies(moduleToInstall);
      }

      // 3. Download module bundle (if remote)
      if (moduleToInstall.downloadUrl) {
        await this.downloadModule(moduleToInstall);
      }

      // 4. Register module in registry
      moduleRegistry.register(moduleToInstall);

      // 5. Save to persistent storage
      await this.saveModuleConfig(moduleToInstall);

      // 6. Add to installed modules
      this.installedModules.set(moduleId, moduleToInstall);

      console.log(`✅ Module installed successfully: ${moduleToInstall.name}`);
    } catch (error) {
      console.error(`❌ Failed to install module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Uninstall a module
   */
  async uninstallModule(moduleId: string): Promise<void> {
    try {
      console.log(`🗑️  Uninstalling module: ${moduleId}`);

      // Check if module exists
      if (!this.installedModules.has(moduleId)) {
        throw new PluginError(
          `Module ${moduleId} is not installed`,
          'NOT_INSTALLED'
        );
      }

      // Check if other modules depend on this
      const dependents = this.findDependents(moduleId);
      if (dependents.length > 0) {
        throw new DependencyError(
          `Cannot uninstall ${moduleId}. Required by: ${dependents.join(', ')}`
        );
      }

      // Unregister from module registry
      moduleRegistry.unregister(moduleId);

      // Remove from persistent storage
      await this.removeModuleConfig(moduleId);

      // Remove from installed modules
      this.installedModules.delete(moduleId);

      console.log(`✅ Module uninstalled: ${moduleId}`);
    } catch (error) {
      console.error(`❌ Failed to uninstall module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Update a module to latest version
   */
  async updateModule(moduleId: string): Promise<void> {
    try {
      console.log(`🔄 Updating module: ${moduleId}`);

      const currentModule = this.installedModules.get(moduleId);
      const latestModule = this.marketplace.find((m) => m.id === moduleId);

      if (!currentModule) {
        throw new PluginError(
          `Module ${moduleId} is not installed`,
          'NOT_INSTALLED'
        );
      }

      if (!latestModule) {
        throw new PluginError(
          `Module ${moduleId} not found in marketplace`,
          'NOT_FOUND'
        );
      }

      if (latestModule.version === currentModule.version) {
        console.log(
          `✅ Module ${moduleId} is already up to date (v${currentModule.version})`
        );
        return;
      }

      console.log(
        `Updating ${moduleId} from v${currentModule.version} to v${latestModule.version}`
      );

      // Update strategy: uninstall old, install new
      await this.uninstallModule(moduleId);
      await this.installModule(moduleId);

      console.log(`✅ Module updated successfully: ${moduleId}`);
    } catch (error) {
      console.error(`❌ Failed to update module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Get available updates for installed modules
   */
  getAvailableUpdates(): ModuleUpdateInfo[] {
    const updates: ModuleUpdateInfo[] = [];

    this.installedModules.forEach((installedModule, moduleId) => {
      const marketplaceModule = this.marketplace.find((m) => m.id === moduleId);

      if (
        marketplaceModule &&
        marketplaceModule.version !== installedModule.version
      ) {
        updates.push({
          module: installedModule,
          currentVersion: installedModule.version,
          latestVersion: marketplaceModule.version,
        });
      }
    });

    return updates;
  }

  /**
   * Check and install module dependencies
   */
  private async checkAndInstallDependencies(
    modulePackage: ModulePackage
  ): Promise<void> {
    if (
      !modulePackage.dependencies ||
      modulePackage.dependencies.length === 0
    ) {
      return;
    }

    console.log(`📦 Checking dependencies for ${modulePackage.id}...`);

    for (const depId of modulePackage.dependencies) {
      // Check if dependency is already installed
      if (!moduleRegistry.get(depId) && !this.installedModules.has(depId)) {
        console.log(`📥 Installing dependency: ${depId}`);
        await this.installModule(depId, { skipDependencies: false });
      } else {
        console.log(`✅ Dependency already installed: ${depId}`);
      }
    }
  }

  /**
   * Find modules that depend on this module
   */
  private findDependents(moduleId: string): string[] {
    const dependents: string[] = [];

    this.installedModules.forEach((moduleConfig, id) => {
      if (moduleConfig.dependencies?.includes(moduleId)) {
        dependents.push(id);
      }
    });

    return dependents;
  }

  /**
   * Validate module configuration
   */
  private async validateModule(
    modulePackage: ModulePackage
  ): Promise<ModuleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!modulePackage.id) errors.push('Module ID is required');
    if (!modulePackage.name) errors.push('Module name is required');
    if (!modulePackage.version) errors.push('Module version is required');

    // Version format validation
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (modulePackage.version && !versionRegex.test(modulePackage.version)) {
      errors.push('Invalid version format (must be X.Y.Z)');
    }

    // ID format validation
    const idRegex = /^[a-z0-9-]+$/;
    if (modulePackage.id && !idRegex.test(modulePackage.id)) {
      errors.push(
        'Invalid module ID format (must be lowercase alphanumeric with hyphens)'
      );
    }

    // Check for conflicts
    const existing = moduleRegistry.get(modulePackage.id);
    if (existing && existing.version === modulePackage.version) {
      warnings.push(
        `Module ${modulePackage.id} v${modulePackage.version} is already registered`
      );
    }

    // Check dependencies exist in marketplace
    if (modulePackage.dependencies) {
      for (const depId of modulePackage.dependencies) {
        const depExists = this.marketplace.some((m) => m.id === depId);
        if (!depExists && !moduleRegistry.get(depId)) {
          errors.push(`Dependency ${depId} not found in marketplace`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Download module bundle from remote URL
   */
  private async downloadModule(modulePackage: ModulePackage): Promise<void> {
    if (!modulePackage.downloadUrl) {
      throw new DownloadError(`No download URL for module ${modulePackage.id}`);
    }

    try {
      console.log(
        `📥 Downloading module: ${modulePackage.id} v${modulePackage.version}`
      );
      console.log(`📍 From: ${modulePackage.downloadUrl}`);

      // Call the download API
      const response = await fetch('/api/modules/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: modulePackage.id,
          downloadUrl: modulePackage.downloadUrl,
          version: modulePackage.version,
          checksum: modulePackage.checksum,
          size: modulePackage.size,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          (errorData as { error?: string }).error ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new DownloadError(errorMessage);
      }

      const result = await response.json();

      if (!result.success) {
        throw new DownloadError(
          result.error || 'Download failed with unknown error'
        );
      }

      // Update module package with installation path
      modulePackage.installPath = result.installPath;

      console.log(`✅ Module downloaded successfully`);
      console.log(`📦 Size: ${result.size} bytes`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`📂 Installed to: ${result.installPath}`);
    } catch (error) {
      if (error instanceof PluginError) throw error;
      throw new DownloadError(`Download failed: ${(error as Error).message}`);
    }
  }

  /**
   * Save module configuration to database
   */
  private async saveModuleConfig(modulePackage: ModulePackage): Promise<void> {
    try {
      const response = await fetch('/api/modules/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modulePackage),
      });

      if (!response.ok) {
        throw new Error(`Failed to save module config: ${response.statusText}`);
      }

      console.log(`💾 Module configuration saved: ${modulePackage.id}`);
    } catch (error) {
      console.error('Failed to save module config:', error);
      throw new PluginError(
        `Failed to save module config: ${(error as Error).message}`,
        'SAVE_ERROR'
      );
    }
  }

  /**
   * Remove module configuration from database
   */
  private async removeModuleConfig(moduleId: string): Promise<void> {
    try {
      const response = await fetch(`/api/modules/config/${moduleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to remove module config: ${response.statusText}`
        );
      }

      console.log(`🗑️  Module configuration removed: ${moduleId}`);
    } catch (error) {
      console.error('Failed to remove module config:', error);
      throw new PluginError(
        `Failed to remove module config: ${(error as Error).message}`,
        'DELETE_ERROR'
      );
    }
  }

  /**
   * Load installed modules from database
   */
  private async loadInstalledModules(): Promise<void> {
    try {
      const response = await fetch('/api/modules/config');

      if (!response.ok) {
        // If no modules exist yet, that's okay
        if (response.status === 404) {
          console.log('ℹ️  No installed modules found');
          return;
        }
        throw new Error(`Failed to load modules: ${response.statusText}`);
      }

      const modules: ModulePackage[] = await response.json();

      modules.forEach((modulePackage) => {
        this.installedModules.set(modulePackage.id, modulePackage);

        // Re-register module in registry if enabled
        if (modulePackage.enabled) {
          moduleRegistry.register(modulePackage);
        }
      });

      console.log(`✅ Loaded ${modules.length} installed modules`);
    } catch (error) {
      console.error('Failed to load installed modules:', error);
      // Don't throw - allow system to start with empty module list
    }
  }

  /**
   * Get statistics about plugins
   */
  getStats() {
    const updates = this.getAvailableUpdates();

    return {
      installed: this.installedModules.size,
      marketplace: this.marketplace.length,
      updatesAvailable: updates.length,
      enabled: Array.from(this.installedModules.values()).filter(
        (m) => m.enabled
      ).length,
      disabled: Array.from(this.installedModules.values()).filter(
        (m) => !m.enabled
      ).length,
    };
  }

  /**
   * Get all installed modules
   */
  getInstalled(): ModulePackage[] {
    return Array.from(this.installedModules.values());
  }

  /**
   * Check if module is installed
   */
  isInstalled(moduleId: string): boolean {
    return this.installedModules.has(moduleId);
  }

  /**
   * Get module by ID
   */
  getModule(moduleId: string): ModulePackage | undefined {
    return this.installedModules.get(moduleId);
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
