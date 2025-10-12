/**
 * Module Sandbox - Permission and Security System
 *
 * This service handles:
 * - Module permission management
 * - API access control
 * - Resource usage monitoring
 * - Security policy enforcement
 * - Isolated execution environment
 */

import type {
  ModulePermissionType,
  ModulePermissionRequest,
  ModulePermissionGrant,
  ModuleSandboxConfig,
  ResourceUsage,
} from '@/types/module-system';

// ============================================================================
// SANDBOX ERRORS
// ============================================================================

export class SandboxError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

export class PermissionDeniedError extends SandboxError {
  constructor(permission: ModulePermissionType, moduleId: string) {
    super(
      `Permission denied: ${permission} for module ${moduleId}`,
      'PERMISSION_DENIED'
    );
  }
}

export class ResourceLimitError extends SandboxError {
  constructor(resource: string, limit: number) {
    super(
      `Resource limit exceeded: ${resource} (limit: ${limit})`,
      'RESOURCE_LIMIT_EXCEEDED'
    );
  }
}

// ============================================================================
// MODULE SANDBOX CLASS
// ============================================================================

class ModuleSandbox {
  private permissions = new Map<string, Set<ModulePermissionType>>();
  private resourceUsage = new Map<string, ResourceUsage>();
  private sandboxConfigs = new Map<string, ModuleSandboxConfig>();

  private readonly DEFAULT_PERMISSIONS: ModulePermissionType[] = ['ui.render'];

  private readonly DEFAULT_LIMITS = {
    maxMemoryMB: 100,
    maxCPUPercent: 50,
    maxStorageMB: 10,
    maxNetworkRequests: 100,
  };

  /**
   * Initialize sandbox for a module
   */
  async initializeSandbox(
    moduleId: string,
    config?: Partial<ModuleSandboxConfig>
  ): Promise<void> {
    try {
      console.log(`🛡️  Initializing sandbox for: ${moduleId}`);

      // Create sandbox config
      const sandboxConfig: ModuleSandboxConfig = {
        moduleId,
        isolated: config?.isolated ?? true,
        permissions: config?.permissions ?? this.DEFAULT_PERMISSIONS,
        limits: {
          ...this.DEFAULT_LIMITS,
          ...config?.limits,
        },
      };

      // Store config
      this.sandboxConfigs.set(moduleId, sandboxConfig);

      // Initialize permissions
      const permissionSet = new Set(sandboxConfig.permissions);
      this.permissions.set(moduleId, permissionSet);

      // Initialize resource tracking
      this.resourceUsage.set(moduleId, {
        memoryMB: 0,
        cpuPercent: 0,
        storageMB: 0,
        networkRequests: 0,
        lastUpdated: Date.now(),
      });

      console.log(
        `✅ Sandbox initialized with ${permissionSet.size} permissions`
      );
    } catch (error) {
      throw new SandboxError(
        `Failed to initialize sandbox: ${(error as Error).message}`,
        'INIT_FAILED'
      );
    }
  }

  /**
   * Check if module has permission
   */
  hasPermission(moduleId: string, permission: ModulePermissionType): boolean {
    const modulePermissions = this.permissions.get(moduleId);

    if (!modulePermissions) {
      return false;
    }

    return modulePermissions.has(permission);
  }

  /**
   * Request permission for module
   */
  async requestPermission(
    moduleId: string,
    request: ModulePermissionRequest
  ): Promise<ModulePermissionGrant> {
    try {
      console.log(
        `🔐 Permission request: ${request.permission} for ${moduleId}`
      );

      // Check if already granted
      if (this.hasPermission(moduleId, request.permission)) {
        return {
          granted: true,
          permission: request.permission,
          moduleId,
          grantedAt: Date.now(),
        };
      }

      // Check if permission is dangerous
      const isDangerous = this.isDangerousPermission(request.permission);

      if (isDangerous && !request.userApproval) {
        console.warn(
          `⚠️  Dangerous permission requires user approval: ${request.permission}`
        );

        return {
          granted: false,
          permission: request.permission,
          moduleId,
          reason: 'User approval required for dangerous permission',
        };
      }

      // Grant permission
      const modulePermissions = this.permissions.get(moduleId) || new Set();
      modulePermissions.add(request.permission);
      this.permissions.set(moduleId, modulePermissions);

      console.log(`✅ Permission granted: ${request.permission}`);

      return {
        granted: true,
        permission: request.permission,
        moduleId,
        grantedAt: Date.now(),
      };
    } catch (error) {
      throw new SandboxError(
        `Permission request failed: ${(error as Error).message}`,
        'PERMISSION_REQUEST_FAILED'
      );
    }
  }

  /**
   * Revoke permission from module
   */
  revokePermission(moduleId: string, permission: ModulePermissionType): void {
    const modulePermissions = this.permissions.get(moduleId);

    if (modulePermissions) {
      modulePermissions.delete(permission);
      console.log(`🔒 Permission revoked: ${permission} from ${moduleId}`);
    }
  }

  /**
   * Get all permissions for module
   */
  getPermissions(moduleId: string): ModulePermissionType[] {
    const permissions = this.permissions.get(moduleId);
    return permissions ? Array.from(permissions) : [];
  }

  /**
   * Check if permission is dangerous
   */
  private isDangerousPermission(permission: ModulePermissionType): boolean {
    const dangerousPermissions: ModulePermissionType[] = [
      'database.write',
      'database.delete',
      'files.write',
      'files.delete',
      'network.external',
      'system.process',
    ];

    return dangerousPermissions.includes(permission);
  }

  /**
   * Enforce permission check
   */
  enforcePermission(moduleId: string, permission: ModulePermissionType): void {
    if (!this.hasPermission(moduleId, permission)) {
      throw new PermissionDeniedError(permission, moduleId);
    }
  }

  /**
   * Update resource usage
   */
  updateResourceUsage(moduleId: string, usage: Partial<ResourceUsage>): void {
    const current = this.resourceUsage.get(moduleId);

    if (!current) {
      console.warn(`⚠️  No resource tracking for module: ${moduleId}`);
      return;
    }

    const updated: ResourceUsage = {
      memoryMB: usage.memoryMB ?? current.memoryMB,
      cpuPercent: usage.cpuPercent ?? current.cpuPercent,
      storageMB: usage.storageMB ?? current.storageMB,
      networkRequests: usage.networkRequests ?? current.networkRequests,
      lastUpdated: Date.now(),
    };

    this.resourceUsage.set(moduleId, updated);

    // Check limits
    this.checkResourceLimits(moduleId, updated);
  }

  /**
   * Check resource limits
   */
  private checkResourceLimits(moduleId: string, usage: ResourceUsage): void {
    const config = this.sandboxConfigs.get(moduleId);

    if (!config) {
      return;
    }

    const { limits } = config;

    // Check memory
    if (limits.maxMemoryMB && usage.memoryMB > limits.maxMemoryMB) {
      console.error(
        `❌ Memory limit exceeded for ${moduleId}: ${usage.memoryMB}MB > ${limits.maxMemoryMB}MB`
      );
      throw new ResourceLimitError('memory', limits.maxMemoryMB);
    }

    // Check CPU
    if (limits.maxCPUPercent && usage.cpuPercent > limits.maxCPUPercent) {
      console.warn(
        `⚠️  CPU usage high for ${moduleId}: ${usage.cpuPercent}% > ${limits.maxCPUPercent}%`
      );
    }

    // Check storage
    if (limits.maxStorageMB && usage.storageMB > limits.maxStorageMB) {
      console.error(
        `❌ Storage limit exceeded for ${moduleId}: ${usage.storageMB}MB > ${limits.maxStorageMB}MB`
      );
      throw new ResourceLimitError('storage', limits.maxStorageMB);
    }

    // Check network
    if (
      limits.maxNetworkRequests &&
      usage.networkRequests > limits.maxNetworkRequests
    ) {
      console.error(
        `❌ Network request limit exceeded for ${moduleId}: ${usage.networkRequests} > ${limits.maxNetworkRequests}`
      );
      throw new ResourceLimitError('network', limits.maxNetworkRequests);
    }
  }

  /**
   * Get resource usage for module
   */
  getResourceUsage(moduleId: string): ResourceUsage | undefined {
    return this.resourceUsage.get(moduleId);
  }

  /**
   * Get sandbox configuration
   */
  getSandboxConfig(moduleId: string): ModuleSandboxConfig | undefined {
    return this.sandboxConfigs.get(moduleId);
  }

  /**
   * Create secure API proxy for module
   */
  createSecureAPIProxy<T extends object>(moduleId: string, apiObject: T): T {
    return new Proxy(apiObject, {
      get: (target, prop) => {
        // Check if module has permission to access this API
        const propName = String(prop);

        // Map API access to permissions
        if (propName.startsWith('database')) {
          this.enforcePermission(moduleId, 'database.read');
        } else if (propName.startsWith('files')) {
          this.enforcePermission(moduleId, 'files.read');
        } else if (propName.includes('fetch') || propName.includes('http')) {
          this.enforcePermission(moduleId, 'network.internal');
        }

        // Return the property
        return target[prop as keyof T];
      },

      set: (target, prop, value) => {
        // Check write permissions
        const propName = String(prop);

        if (propName.startsWith('database')) {
          this.enforcePermission(moduleId, 'database.write');
        } else if (propName.startsWith('files')) {
          this.enforcePermission(moduleId, 'files.write');
        }

        // Set the property
        target[prop as keyof T] = value;
        return true;
      },
    });
  }

  /**
   * Destroy sandbox for module
   */
  destroySandbox(moduleId: string): void {
    this.permissions.delete(moduleId);
    this.resourceUsage.delete(moduleId);
    this.sandboxConfigs.delete(moduleId);

    console.log(`🗑️  Sandbox destroyed for: ${moduleId}`);
  }

  /**
   * Get sandbox statistics
   */
  getStatistics(): {
    totalSandboxes: number;
    totalPermissions: number;
    averageResourceUsage: ResourceUsage;
  } {
    const totalSandboxes = this.sandboxConfigs.size;
    let totalPermissions = 0;

    const permissionsArray = Array.from(this.permissions.values());
    for (const perms of permissionsArray) {
      totalPermissions += perms.size;
    }

    // Calculate average resource usage
    const usageArray = Array.from(this.resourceUsage.values());
    const avgMemory =
      usageArray.reduce((sum, u) => sum + u.memoryMB, 0) /
      (usageArray.length || 1);
    const avgCPU =
      usageArray.reduce((sum, u) => sum + u.cpuPercent, 0) /
      (usageArray.length || 1);
    const avgStorage =
      usageArray.reduce((sum, u) => sum + u.storageMB, 0) /
      (usageArray.length || 1);
    const avgNetwork =
      usageArray.reduce((sum, u) => sum + u.networkRequests, 0) /
      (usageArray.length || 1);

    return {
      totalSandboxes,
      totalPermissions,
      averageResourceUsage: {
        memoryMB: avgMemory,
        cpuPercent: avgCPU,
        storageMB: avgStorage,
        networkRequests: avgNetwork,
        lastUpdated: Date.now(),
      },
    };
  }

  /**
   * Cleanup all sandboxes
   */
  cleanup(): void {
    this.permissions.clear();
    this.resourceUsage.clear();
    this.sandboxConfigs.clear();

    console.log('🗑️  All sandboxes cleaned up');
  }
}

// Singleton instance
export const moduleSandbox = new ModuleSandbox();

// Export class for testing
export { ModuleSandbox };
