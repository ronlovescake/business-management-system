/**
 * Module Bundler - Module Package and Validation System
 *
 * This service handles:
 * - Module bundle validation
 * - Dependency resolution
 * - Module structure verification
 * - Package preparation for distribution
 * - Checksum verification
 */

import { moduleRegistry } from './ModuleRegistry';
import type { ModuleConfig, ModulePackage } from './ModuleRegistry';
import type {
  ModuleBundle,
  ModuleBundleFormat,
  BundleValidationResult,
} from '@/types/module-system';

// ============================================================================
// MODULE BUNDLER ERRORS
// ============================================================================

export class BundlerError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'BundlerError';
  }
}

export class ValidationError extends BundlerError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// ============================================================================
// MODULE BUNDLER CLASS
// ============================================================================

class ModuleBundler {
  private readonly MAX_BUNDLE_SIZE_MB = 10;
  private readonly REQUIRED_FILES = ['index.tsx', 'module.config.ts'];
  private readonly SUPPORTED_FORMATS: ModuleBundleFormat[] = [
    'esm',
    'cjs',
    'umd',
  ];

  /**
   * Validate module package structure
   */
  async validateModulePackage(
    modulePackage: ModulePackage
  ): Promise<BundleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate module ID
      if (!modulePackage.id || modulePackage.id.trim().length === 0) {
        errors.push('Module ID is required');
      }

      // Validate module name
      if (!modulePackage.name || modulePackage.name.trim().length === 0) {
        errors.push('Module name is required');
      }

      // Validate version
      if (!this.isValidVersion(modulePackage.version)) {
        errors.push(
          `Invalid version format: ${modulePackage.version}. Must be semver (e.g., 1.0.0)`
        );
      }

      // Validate dependencies
      if (modulePackage.dependencies) {
        const depValidation = await this.validateDependencies(
          modulePackage.dependencies
        );
        if (!depValidation.valid) {
          errors.push(...depValidation.errors);
          warnings.push(...depValidation.warnings);
        }
      }

      // Validate download URL if provided
      if (
        modulePackage.downloadUrl &&
        !this.isValidURL(modulePackage.downloadUrl)
      ) {
        errors.push(`Invalid download URL: ${modulePackage.downloadUrl}`);
      }

      // Validate source
      if (
        modulePackage.source &&
        !['local', 'npm', 'git', 'marketplace'].includes(modulePackage.source)
      ) {
        errors.push(`Invalid source type: ${modulePackage.source}`);
      }

      // Size validation
      const sizeValid =
        !modulePackage.size ||
        modulePackage.size <= this.MAX_BUNDLE_SIZE_MB * 1024 * 1024;
      if (!sizeValid) {
        errors.push(
          `Module size exceeds maximum: ${modulePackage.size} bytes (max: ${this.MAX_BUNDLE_SIZE_MB}MB)`
        );
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        dependenciesValid: errors.length === 0,
        sizeValid,
      };
    } catch (error) {
      errors.push(`Validation error: ${(error as Error).message}`);
      return {
        valid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Validate dependencies
   */
  private async validateDependencies(
    dependencies: string[]
  ): Promise<BundleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const depId of dependencies) {
      // Check if dependency exists in registry
      const depModule = moduleRegistry.get(depId);

      if (!depModule) {
        warnings.push(
          `Dependency not found in registry: ${depId}. It must be installed separately.`
        );
        continue;
      }

      // Check if dependency is enabled
      if (!depModule.enabled) {
        errors.push(
          `Dependency is disabled: ${depId}. Enable it before installing this module.`
        );
      }

      // Check for circular dependencies
      if (depModule.dependencies && depModule.dependencies.length > 0) {
        // Simple check - in production, you'd want a more robust cycle detection
        const hasCircular = this.detectCircularDependency(depId, dependencies);
        if (hasCircular) {
          errors.push(`Circular dependency detected: ${depId}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      dependenciesValid: errors.length === 0,
    };
  }

  /**
   * Detect circular dependencies (simplified)
   */
  private detectCircularDependency(
    depId: string,
    parentDeps: string[]
  ): boolean {
    const depModule = moduleRegistry.get(depId);
    if (!depModule || !depModule.dependencies) {
      return false;
    }

    // Check if any of the dependency's dependencies are in our parent chain
    return depModule.dependencies.some((dep) => parentDeps.includes(dep));
  }

  /**
   * Validate bundle structure
   */
  async validateBundle(bundle: ModuleBundle): Promise<BundleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate module ID
      if (!bundle.moduleId || bundle.moduleId.trim().length === 0) {
        errors.push('Bundle module ID is required');
      }

      // Validate version
      if (!this.isValidVersion(bundle.version)) {
        errors.push(`Invalid bundle version: ${bundle.version}`);
      }

      // Validate format
      if (!this.SUPPORTED_FORMATS.includes(bundle.format)) {
        errors.push(
          `Unsupported bundle format: ${bundle.format}. Supported: ${this.SUPPORTED_FORMATS.join(', ')}`
        );
      }

      // Validate code
      if (!bundle.code || bundle.code.trim().length === 0) {
        errors.push('Bundle code is empty');
      }

      // Validate checksum
      const checksumValid = await this.verifyChecksum(
        bundle.code,
        bundle.checksum
      );
      if (!checksumValid) {
        errors.push('Bundle checksum verification failed');
      }

      // Validate size
      const sizeValid = bundle.size <= this.MAX_BUNDLE_SIZE_MB * 1024 * 1024;
      if (!sizeValid) {
        errors.push(
          `Bundle size exceeds maximum: ${bundle.size} bytes (max: ${this.MAX_BUNDLE_SIZE_MB}MB)`
        );
      }

      // Validate entry point
      if (!bundle.entryPoint || bundle.entryPoint.trim().length === 0) {
        errors.push('Bundle entry point is required');
      }

      // Validate files array
      if (!bundle.files || bundle.files.length === 0) {
        warnings.push('Bundle files array is empty');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        checksumValid,
        sizeValid,
      };
    } catch (error) {
      errors.push(`Bundle validation error: ${(error as Error).message}`);
      return {
        valid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Calculate bundle checksum (SHA-256)
   */
  async calculateChecksum(code: string): Promise<string> {
    try {
      // Use Web Crypto API for SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hashHex;
    } catch (error) {
      throw new BundlerError(
        `Failed to calculate checksum: ${(error as Error).message}`,
        'CHECKSUM_ERROR'
      );
    }
  }

  /**
   * Verify bundle checksum
   */
  async verifyChecksum(
    code: string,
    expectedChecksum: string
  ): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChecksum(code);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      logger.error('Checksum verification error:', error);
      return false;
    }
  }

  /**
   * Resolve module dependencies
   */
  async resolveDependencies(
    moduleId: string
  ): Promise<{ resolved: ModuleConfig[]; missing: string[] }> {
    const moduleConfig = moduleRegistry.get(moduleId);

    if (!moduleConfig) {
      throw new BundlerError(
        `Module not found: ${moduleId}`,
        'MODULE_NOT_FOUND'
      );
    }

    if (!moduleConfig.dependencies || moduleConfig.dependencies.length === 0) {
      return { resolved: [], missing: [] };
    }

    const resolved: ModuleConfig[] = [];
    const missing: string[] = [];

    for (const depId of moduleConfig.dependencies) {
      const depModule = moduleRegistry.get(depId);

      if (depModule) {
        resolved.push(depModule);
      } else {
        missing.push(depId);
      }
    }

    return { resolved, missing };
  }

  /**
   * Get dependency tree
   */
  async getDependencyTree(
    moduleId: string,
    visited: Set<string> = new Set()
  ): Promise<Map<string, ModuleConfig>> {
    const tree = new Map<string, ModuleConfig>();

    // Prevent infinite recursion
    if (visited.has(moduleId)) {
      return tree;
    }

    visited.add(moduleId);

    const moduleConfig = moduleRegistry.get(moduleId);

    if (!moduleConfig) {
      return tree;
    }

    tree.set(moduleId, moduleConfig);

    if (moduleConfig.dependencies && moduleConfig.dependencies.length > 0) {
      for (const depId of moduleConfig.dependencies) {
        const depTree = await this.getDependencyTree(depId, visited);
        depTree.forEach((depModule, id) => {
          if (!tree.has(id)) {
            tree.set(id, depModule);
          }
        });
      }
    }

    return tree;
  }

  /**
   * Prepare module for bundling
   */
  async prepareModuleBundle(
    modulePackage: ModulePackage,
    code: string,
    format: ModuleBundleFormat = 'esm'
  ): Promise<ModuleBundle> {
    try {
      // Validate module package first
      const validation = await this.validateModulePackage(modulePackage);

      if (!validation.valid) {
        throw new ValidationError(
          `Module package validation failed: ${validation.errors.join(', ')}`
        );
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(code);

      // Calculate size
      const size = new Blob([code]).size;

      // Create bundle
      const bundle: ModuleBundle = {
        moduleId: modulePackage.id,
        version: modulePackage.version,
        format,
        code,
        checksum,
        size,
        bundledAt: Date.now(),
        entryPoint: 'index.tsx',
        files: this.REQUIRED_FILES,
        externals: modulePackage.dependencies || [],
      };

      // Validate bundle
      const bundleValidation = await this.validateBundle(bundle);

      if (!bundleValidation.valid) {
        throw new ValidationError(
          `Bundle validation failed: ${bundleValidation.errors.join(', ')}`
        );
      }

      logger.debug(
        `✅ Module bundle prepared: ${modulePackage.id} (${size} bytes)`
      );

      return bundle;
    } catch (error) {
      if (error instanceof BundlerError) {
        throw error;
      }
      throw new BundlerError(
        `Failed to prepare bundle: ${(error as Error).message}`,
        'BUNDLE_PREP_ERROR'
      );
    }
  }

  /**
   * Validate version format (semver)
   */
  private isValidVersion(version: string): boolean {
    // Simple semver validation: X.Y.Z format
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  /**
   * Validate URL format
   */
  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get bundler statistics
   */
  getStats() {
    const allModules = moduleRegistry.getAll();

    return {
      totalModules: allModules.length,
      maxBundleSizeMB: this.MAX_BUNDLE_SIZE_MB,
      supportedFormats: this.SUPPORTED_FORMATS,
      requiredFiles: this.REQUIRED_FILES,
    };
  }
}

// Singleton instance
export const moduleBundler = new ModuleBundler();

// Export class for testing
export { ModuleBundler };
