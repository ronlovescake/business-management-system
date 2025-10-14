'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VersionSnapshot<T> {
  id: string;
  timestamp: number;
  data: T[];
  changeType:
    | 'edit'
    | 'add'
    | 'delete'
    | 'bulk'
    | 'import'
    | 'restore'
    | 'invoice'
    | 'status-update';
  changeCount: number;
  description: string;
  userName?: string;
  changedRows?: number[]; // IDs of affected rows
  metadata?: {
    operation?: string;
    affectedFields?: string[];
    customLabel?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}

interface VersionDiff<T> {
  added: T[];
  removed: T[];
  modified: Array<{
    old: T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new: T;
    changes: Record<string, { old: any; new: any }>;
  }>;
}

interface VersionHistoryDB extends DBSchema {
  versions: {
    key: string;
    value: VersionSnapshot<any>;
    indexes: {
      'by-timestamp': number;
      'by-type': string;
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}

const DB_NAME = 'version-history-db';
const STORE_NAME = 'versions';
const MAX_LOCAL_VERSIONS = 100; // Keep last 100 versions locally
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const GROUPING_WINDOW = 30 * 1000; // 30 seconds for grouping rapid changes

export function useVersionHistory<T extends Record<string, any>>(
  dataKey: string,
  currentData: T[]
) {
  const [versions, setVersions] = useState<VersionSnapshot<T>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dbRef = useRef<IDBPDatabase<VersionHistoryDB> | null>(null);
  const lastSyncRef = useRef<number>(Date.now());
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastChangeRef = useRef<{ timestamp: number; type: string } | null>(
    null
  );
  const pendingChangesRef = useRef<{
    type: VersionSnapshot<T>['changeType'];
    count: number;
    description: string;
    changedRows: number[];
  } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize IndexedDB
  const initDB = useCallback(async () => {
    try {
      const db = await openDB<VersionHistoryDB>(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('by-timestamp', 'timestamp');
            store.createIndex('by-type', 'changeType');
          }
        },
      });
      dbRef.current = db;
      return db;
    } catch (error) {
      logger.error('Failed to initialize IndexedDB:', error);
      return null;
    }
  }, []);

  // Load versions from IndexedDB
  const loadVersions = useCallback(async () => {
    try {
      const db = dbRef.current || (await initDB());
      if (!db) return;

      const allVersions = await db.getAllFromIndex(STORE_NAME, 'by-timestamp');

      // Filter versions for this specific data key and sort by timestamp (newest first)
      const filteredVersions = allVersions
        .filter((v) => v.id.startsWith(dataKey))
        .sort((a, b) => b.timestamp - a.timestamp);

      setVersions(filteredVersions as VersionSnapshot<T>[]);
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load versions:', error);
      setIsLoading(false);
    }
  }, [dataKey, initDB]);

  // Calculate diff between two versions
  const calculateDiff = useCallback(
    (oldData: T[], newData: T[]): VersionDiff<T> => {
      const oldMap = new Map(oldData.map((item) => [item.id, item]));
      const newMap = new Map(newData.map((item) => [item.id, item]));

      const added: T[] = [];
      const removed: T[] = [];
      const modified: VersionDiff<T>['modified'] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Find added and modified
      newData.forEach((newItem) => {
        const oldItem = oldMap.get(newItem.id);
        if (!oldItem) {
          added.push(newItem);
        } else {
          // Check if modified
          const changes: Record<string, { old: any; new: any }> = {};
          Object.keys(newItem).forEach((key) => {
            if (JSON.stringify(oldItem[key]) !== JSON.stringify(newItem[key])) {
              changes[key] = { old: oldItem[key], new: newItem[key] };
            }
          });
          if (Object.keys(changes).length > 0) {
            modified.push({ old: oldItem, new: newItem, changes });
          }
        }
      });

      // Find removed
      oldData.forEach((oldItem) => {
        if (!newMap.has(oldItem.id)) {
          removed.push(oldItem);
        }
      });

      return { added, removed, modified };
    },
    []
  );

  // Flush pending changes to create actual version
  const flushPendingChanges = useCallback(async () => {
    if (!pendingChangesRef.current) return null;

    try {
      const db = dbRef.current || (await initDB());
      if (!db) return null;

      const pending = pendingChangesRef.current;
      const snapshot: VersionSnapshot<T> = {
        id: `${dataKey}-${Date.now()}`,
        timestamp: Date.now(),
        data: JSON.parse(JSON.stringify(currentData)), // Deep clone
        changeType: pending.type,
        changeCount: pending.count,
        description: pending.description,
        userName: 'You', // TODO: Get from auth context
        changedRows: Array.from(new Set(pending.changedRows)), // Remove duplicates
      };

      await db.add(STORE_NAME, snapshot);

      // Cleanup old versions (keep only MAX_LOCAL_VERSIONS)
      const allVersions = await db.getAllFromIndex(STORE_NAME, 'by-timestamp');
      const dataVersions = allVersions
        .filter((v) => v.id.startsWith(dataKey))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (dataVersions.length > MAX_LOCAL_VERSIONS) {
        const versionsToDelete = dataVersions.slice(MAX_LOCAL_VERSIONS);
        for (const version of versionsToDelete) {
          await db.delete(STORE_NAME, version.id);
        }
      }

      // Reload versions
      await loadVersions();

      logger.debug(`✅ Version saved: ${snapshot.id}`, snapshot);

      // Clear pending
      pendingChangesRef.current = null;

      return snapshot;
    } catch (error) {
      logger.error('Failed to save version:', error);
      return null;
    }
  }, [dataKey, currentData, initDB, loadVersions]);

  // Save a new version snapshot with smart grouping and debouncing
  const saveVersion = useCallback(
    async (
      changeType: VersionSnapshot<T>['changeType'],
      changeCount: number,
      description?: string,
      changedRows?: number[]
    ) => {
      const now = Date.now();

      // Smart grouping: check if we should group with recent change
      const shouldGroup =
        lastChangeRef.current &&
        now - lastChangeRef.current.timestamp < GROUPING_WINDOW &&
        lastChangeRef.current.type === changeType;

      if (shouldGroup && pendingChangesRef.current) {
        // Update pending changes
        pendingChangesRef.current.count += changeCount;
        if (changedRows) {
          pendingChangesRef.current.changedRows.push(...changedRows);
        }

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Set new debounce timer
        debounceTimerRef.current = setTimeout(async () => {
          await flushPendingChanges();
        }, 2000); // Wait 2 seconds of inactivity before saving

        return null;
      }

      // Start new pending change
      pendingChangesRef.current = {
        type: changeType,
        count: changeCount,
        description: description || `${changeType} operation`,
        changedRows: changedRows || [],
      };

      lastChangeRef.current = { timestamp: now, type: changeType };

      // Debounce the save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        await flushPendingChanges();
      }, 2000);

      return null;
    },
    [flushPendingChanges]
  );

  // Save version with custom label (no grouping/debouncing)
  const saveVersionWithLabel = useCallback(
    async (
      label: string,
      changeType: VersionSnapshot<T>['changeType'] = 'bulk',
      changedRows?: number[]
    ) => {
      // Flush any pending changes first
      if (pendingChangesRef.current) {
        await flushPendingChanges();
      }

      try {
        const db = dbRef.current || (await initDB());
        if (!db) return null;

        const snapshot: VersionSnapshot<T> = {
          id: `${dataKey}-${Date.now()}`,
          timestamp: Date.now(),
          data: JSON.parse(JSON.stringify(currentData)),
          changeType,
          changeCount: changedRows?.length || currentData.length,
          description: label,
          userName: 'You',
          changedRows,
          metadata: { customLabel: label },
        };

        await db.add(STORE_NAME, snapshot);
        await loadVersions();

        logger.debug(`✅ Version saved with label: ${label}`, snapshot);
        return snapshot;
      } catch (error) {
        logger.error('Failed to save version with label:', error);
        return null;
      }
    },
    [dataKey, currentData, initDB, loadVersions, flushPendingChanges]
  );

  // Full restore: Replace all data with selected version
  const restoreVersion = useCallback(
    async (versionId: string): Promise<T[] | null> => {
      try {
        // Flush pending changes
        if (pendingChangesRef.current) {
          await flushPendingChanges();
        }

        const db = dbRef.current || (await initDB());
        if (!db) return null;

        const version = await db.get(STORE_NAME, versionId);
        if (!version) {
          logger.error('Version not found:', versionId);
          return null;
        }

        // Save current state before restoring (so user can undo the restore)
        await saveVersionWithLabel(
          `Before restore to "${version.description}"`,
          'restore'
        );

        logger.debug(`🔄 Restoring version: ${versionId}`, version);
        return version.data as T[];
      } catch (error) {
        logger.error('Failed to restore version:', error);
        return null;
      }
    },
    [initDB, flushPendingChanges, saveVersionWithLabel]
  );

  // Selective restore: Cherry-pick specific rows
  const restoreSelectedRows = useCallback(
    async (versionId: string, rowIds: number[]): Promise<T[] | null> => {
      try {
        const db = dbRef.current || (await initDB());
        if (!db) return null;

        const version = await db.get(STORE_NAME, versionId);
        if (!version) {
          logger.error('Version not found:', versionId);
          return null;
        }

        const versionData = version.data as T[];
        const rowsToRestore = versionData.filter((row) =>
          rowIds.includes(row.id)
        );

        // Merge with current data
        const currentMap = new Map(currentData.map((item) => [item.id, item]));
        rowsToRestore.forEach((row) => {
          currentMap.set(row.id, row);
        });

        const mergedData = Array.from(currentMap.values());

        // Save version before selective restore
        await saveVersionWithLabel(
          `Selective restore: ${rowIds.length} rows from "${version.description}"`,
          'restore',
          rowIds
        );

        logger.debug(
          `🔄 Selectively restored ${rowIds.length} rows from: ${versionId}`
        );
        return mergedData;
      } catch (error) {
        logger.error('Failed to restore selected rows:', error);
        return null;
      }
    },
    [currentData, initDB, saveVersionWithLabel]
  );

  // Get diff between current and a version
  const getDiff = useCallback(
    async (versionId: string): Promise<VersionDiff<T> | null> => {
      try {
        const db = dbRef.current || (await initDB());
        if (!db) return null;

        const version = await db.get(STORE_NAME, versionId);
        if (!version) {
          logger.error('Version not found:', versionId);
          return null;
        }

        return calculateDiff(version.data as T[], currentData);
      } catch (error) {
        logger.error('Failed to calculate diff:', error);
        return null;
      }
    },
    [currentData, initDB, calculateDiff]
  );

  // Search versions
  const searchVersions = useCallback(
    async (filters: {
      startDate?: Date;
      endDate?: Date;
      changeType?: VersionSnapshot<T>['changeType'];
      searchText?: string;
    }): Promise<VersionSnapshot<T>[]> => {
      let filtered = [...versions];

      if (filters.startDate) {
        filtered = filtered.filter(
          (v) => v.timestamp >= filters.startDate!.getTime()
        );
      }

      if (filters.endDate) {
        filtered = filtered.filter(
          (v) => v.timestamp <= filters.endDate!.getTime()
        );
      }

      if (filters.changeType) {
        filtered = filtered.filter((v) => v.changeType === filters.changeType);
      }

      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        filtered = filtered.filter(
          (v) =>
            v.description.toLowerCase().includes(searchLower) ||
            v.userName?.toLowerCase().includes(searchLower)
        );
      }

      return filtered;
    },
    [versions]
  );

  // Export version history as CSV
  const exportVersionHistory = useCallback(() => {
    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'Change Type',
      'Description',
      'Changes Count',
      'User',
    ];

    const rows = versions.map((v) => {
      const date = new Date(v.timestamp);
      return [
        v.timestamp,
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        v.changeType,
        v.description,
        v.changeCount,
        v.userName || 'Unknown',
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `version-history-${dataKey}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [versions, dataKey]);

  // Delete a specific version
  const deleteVersion = useCallback(
    async (versionId: string) => {
      try {
        const db = dbRef.current || (await initDB());
        if (!db) return false;

        await db.delete(STORE_NAME, versionId);
        await loadVersions();
        return true;
      } catch (error) {
        logger.error('Failed to delete version:', error);
        return false;
      }
    },
    [initDB, loadVersions]
  );

  // Sync to server
  const syncToServer = useCallback(async () => {
    try {
      logger.debug('🔄 Syncing version history to server...');

      const versionsToSync = versions.filter((v) => v.id.startsWith(dataKey));

      if (versionsToSync.length === 0) {
        logger.debug('ℹ️ No versions to sync');
        return;
      }

      const response = await fetch('/api/version-history/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataKey,
          versions: versionsToSync,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        lastSyncRef.current = Date.now();
        logger.debug(
          `✅ Successfully synced ${versionsToSync.length} versions to server`
        );
      } else {
        logger.error('Failed to sync to server:', await response.text());
      }
    } catch (error) {
      logger.error('Error syncing to server:', error);
    }
  }, [dataKey, versions]);

  // Load versions from server
  const loadFromServer = useCallback(async () => {
    try {
      logger.debug('📥 Loading version history from server...');

      const response = await fetch(
        `/api/version-history?dataKey=${encodeURIComponent(dataKey)}`
      );

      if (response.ok) {
        const serverVersions = await response.json();

        const db = dbRef.current || (await initDB());
        if (!db) return;

        for (const version of serverVersions) {
          try {
            await db.put(STORE_NAME, version);
          } catch (error) {
            logger.warn('Version already exists:', version.id);
          }
        }

        await loadVersions();
        logger.debug(`✅ Loaded ${serverVersions.length} versions from server`);
      }
    } catch (error) {
      logger.error('Error loading from server:', error);
    }
  }, [dataKey, initDB, loadVersions]);

  // Initialize on mount
  useEffect(() => {
    initDB().then(loadVersions);
    loadFromServer();
  }, [initDB, loadVersions, loadFromServer]);

  // Setup hourly sync
  useEffect(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    const timeSinceLastSync = Date.now() - lastSyncRef.current;
    if (timeSinceLastSync >= SYNC_INTERVAL) {
      syncToServer();
    }

    syncIntervalRef.current = setInterval(() => {
      syncToServer();
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [syncToServer]);

  // Flush pending changes before unmount
  useEffect(() => {
    return () => {
      if (pendingChangesRef.current) {
        flushPendingChanges();
      }
    };
  }, [flushPendingChanges]);

  // Sync before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingChangesRef.current) {
        flushPendingChanges();
      }
      syncToServer();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [syncToServer, flushPendingChanges]);

  return {
    versions,
    isLoading,
    saveVersion,
    saveVersionWithLabel,
    restoreVersion,
    restoreSelectedRows,
    getDiff,
    searchVersions,
    exportVersionHistory,
    deleteVersion,
    syncToServer,
    loadFromServer,
    flushPendingChanges,
  };
}

export type { VersionSnapshot, VersionDiff };
