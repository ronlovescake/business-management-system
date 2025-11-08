'use client';

/**
 * useModuleOperations Hook
 *
 * Handles module install, uninstall, update, enable/disable operations
 */

import { useState, useCallback } from 'react';
import { showNotification } from '@mantine/notifications';
import { api } from '@/lib/api/client';
import { LOADING_SPINNER_DELAY } from '@/constants/timeouts';
import type { ModuleOperationStatus, ModuleInstallOptions } from '../types';

interface UseModuleOperationsReturn {
  operationStatus: Map<string, ModuleOperationStatus>;
  installModule: (
    moduleId: string,
    options?: ModuleInstallOptions
  ) => Promise<boolean>;
  uninstallModule: (moduleId: string) => Promise<boolean>;
  updateModule: (moduleId: string) => Promise<boolean>;
  enableModule: (moduleId: string) => Promise<boolean>;
  disableModule: (moduleId: string) => Promise<boolean>;
  isOperationInProgress: (moduleId: string) => boolean;
  getOperationStatus: (moduleId: string) => ModuleOperationStatus | undefined;
}

export function useModuleOperations(): UseModuleOperationsReturn {
  const [operationStatus, setOperationStatus] = useState<
    Map<string, ModuleOperationStatus>
  >(new Map());

  /**
   * Update operation status
   */
  const updateStatus = useCallback(
    (moduleId: string, status: Partial<ModuleOperationStatus>) => {
      setOperationStatus((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(moduleId) || {
          moduleId,
          operation: 'install',
          status: 'idle',
        };
        newMap.set(moduleId, { ...current, ...status });
        return newMap;
      });
    },
    []
  );

  /**
   * Install a module
   */
  const installModule = useCallback(
    async (
      moduleId: string,
      options?: ModuleInstallOptions
    ): Promise<boolean> => {
      try {
        updateStatus(moduleId, { operation: 'install', status: 'loading' });

        await api.post<{ success: boolean; details?: string; error?: string }>(
          '/api/modules/install',
          { moduleId, ...options }
        );

        updateStatus(moduleId, { status: 'success' });

        showNotification({
          title: 'Module Installed',
          message: `Successfully installed module: ${moduleId}`,
          color: 'green',
        });

        return true;
      } catch (err) {
        const error = (err as Error).message;
        updateStatus(moduleId, { status: 'error', error });

        showNotification({
          title: 'Installation Failed',
          message: error,
          color: 'red',
        });

        return false;
      }
    },
    [updateStatus]
  );

  /**
   * Uninstall a module
   */
  const uninstallModule = useCallback(
    async (moduleId: string): Promise<boolean> => {
      try {
        updateStatus(moduleId, { operation: 'uninstall', status: 'loading' });

        await api.post('/api/modules/uninstall', { moduleId });

        updateStatus(moduleId, { status: 'success' });

        showNotification({
          title: 'Module Uninstalled',
          message: `Successfully uninstalled module: ${moduleId}`,
          color: 'green',
        });

        return true;
      } catch (err) {
        const error = (err as Error).message;
        updateStatus(moduleId, { status: 'error', error });

        showNotification({
          title: 'Uninstallation Failed',
          message: error,
          color: 'red',
        });

        return false;
      }
    },
    [updateStatus]
  );

  /**
   * Update a module
   */
  const updateModule = useCallback(
    async (moduleId: string): Promise<boolean> => {
      try {
        updateStatus(moduleId, { operation: 'update', status: 'loading' });

        await api.post('/api/modules/update', { moduleId });

        updateStatus(moduleId, { status: 'success' });

        showNotification({
          title: 'Module Updated',
          message: `Successfully updated module: ${moduleId}`,
          color: 'green',
        });

        return true;
      } catch (err) {
        const error = (err as Error).message;
        updateStatus(moduleId, { status: 'error', error });

        showNotification({
          title: 'Update Failed',
          message: error,
          color: 'red',
        });

        return false;
      }
    },
    [updateStatus]
  );

  /**
   * Enable a module (placeholder - would update module config)
   */
  const enableModule = useCallback(
    async (moduleId: string): Promise<boolean> => {
      try {
        updateStatus(moduleId, { operation: 'enable', status: 'loading' });

        // FUTURE: Implement enable endpoint (POST /api/modules/config/enable)
        // Currently using mock delay for UI demonstration
        await new Promise((resolve) =>
          setTimeout(resolve, LOADING_SPINNER_DELAY)
        );

        updateStatus(moduleId, { status: 'success' });

        showNotification({
          title: 'Module Enabled',
          message: `Successfully enabled module: ${moduleId}`,
          color: 'green',
        });

        return true;
      } catch (err) {
        const error = (err as Error).message;
        updateStatus(moduleId, { status: 'error', error });

        showNotification({
          title: 'Enable Failed',
          message: error,
          color: 'red',
        });

        return false;
      }
    },
    [updateStatus]
  );

  /**
   * Disable a module (placeholder - would update module config)
   */
  const disableModule = useCallback(
    async (moduleId: string): Promise<boolean> => {
      try {
        updateStatus(moduleId, { operation: 'disable', status: 'loading' });

        // FUTURE: Implement disable endpoint (POST /api/modules/config/disable)
        // Currently using mock delay for UI demonstration
        await new Promise((resolve) =>
          setTimeout(resolve, LOADING_SPINNER_DELAY)
        );

        updateStatus(moduleId, { status: 'success' });

        showNotification({
          title: 'Module Disabled',
          message: `Successfully disabled module: ${moduleId}`,
          color: 'green',
        });

        return true;
      } catch (err) {
        const error = (err as Error).message;
        updateStatus(moduleId, { status: 'error', error });

        showNotification({
          title: 'Disable Failed',
          message: error,
          color: 'red',
        });

        return false;
      }
    },
    [updateStatus]
  );

  /**
   * Check if operation is in progress
   */
  const isOperationInProgress = useCallback(
    (moduleId: string): boolean => {
      const status = operationStatus.get(moduleId);
      return status?.status === 'loading';
    },
    [operationStatus]
  );

  /**
   * Get operation status for a module
   */
  const getOperationStatus = useCallback(
    (moduleId: string): ModuleOperationStatus | undefined => {
      return operationStatus.get(moduleId);
    },
    [operationStatus]
  );

  return {
    operationStatus,
    installModule,
    uninstallModule,
    updateModule,
    enableModule,
    disableModule,
    isOperationInProgress,
    getOperationStatus,
  };
}
