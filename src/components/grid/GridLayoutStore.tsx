'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export interface StoredGridColumn {
  id?: string | number;
  title: string;
  width?: number;
  grow?: number;
  align?: string;
}

export interface GridLayoutSnapshot {
  page: string;
  adapter: string;
  recordedAt: string;
  columns: StoredGridColumn[];
  settings?: {
    rowHeight?: number;
    headerHeight?: number;
    [key: string]: unknown;
  };
}

export interface GridLayoutStoreValue {
  layouts: Record<string, GridLayoutSnapshot[]>;
  register: (
    page: string,
    snapshot: Omit<GridLayoutSnapshot, 'page' | 'recordedAt'>
  ) => void;
  getLayouts: (page: string) => GridLayoutSnapshot[];
  exportLayouts: () => GridLayoutSnapshot[];
}

const STORAGE_KEY = 'grid-layout-registry';

const GridLayoutContext = createContext<GridLayoutStoreValue | undefined>(
  undefined
);

function areSnapshotsEqual(a: GridLayoutSnapshot, b: GridLayoutSnapshot) {
  if (a.adapter !== b.adapter) return false;
  if (a.columns.length !== b.columns.length) return false;

  for (let i = 0; i < a.columns.length; i += 1) {
    const colA = a.columns[i];
    const colB = b.columns[i];
    if (
      colA.id !== colB.id ||
      colA.title !== colB.title ||
      colA.width !== colB.width ||
      colA.grow !== colB.grow ||
      colA.align !== colB.align
    ) {
      return false;
    }
  }

  const settingsKeys = new Set([
    ...Object.keys(a.settings ?? {}),
    ...Object.keys(b.settings ?? {}),
  ]);

  for (const key of Array.from(settingsKeys)) {
    if ((a.settings ?? {})[key] !== (b.settings ?? {})[key]) {
      return false;
    }
  }

  return true;
}

function loadInitialLayouts(): Record<string, GridLayoutSnapshot[]> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored) as Record<string, GridLayoutSnapshot[]>;
    return parsed ?? {};
  } catch (error) {
    logger.warn('Failed to parse stored grid layouts', error);
    return {};
  }
}

export function GridLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [layouts, setLayouts] =
    useState<Record<string, GridLayoutSnapshot[]>>(loadInitialLayouts);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (
        window as unknown as {
          __GRID_LAYOUTS__?: Record<string, GridLayoutSnapshot[]>;
        }
      ).__GRID_LAYOUTS__ = layouts;
    }
  }, [layouts]);

  const register = useCallback<GridLayoutStoreValue['register']>(
    (page, snapshot) => {
      setLayouts((previous) => {
        const nextSnapshot: GridLayoutSnapshot = {
          page,
          recordedAt: new Date().toISOString(),
          ...snapshot,
        };

        const existing = previous[page] ?? [];
        const last = existing[existing.length - 1];
        if (last && areSnapshotsEqual(last, nextSnapshot)) {
          return previous;
        }

        const nextList = [...existing, nextSnapshot];
        const nextLayouts = { ...previous, [page]: nextList };

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLayouts));
        }

        return nextLayouts;
      });
    },
    []
  );

  const getLayouts = useCallback<GridLayoutStoreValue['getLayouts']>(
    (page) => layouts[page] ?? [],
    [layouts]
  );

  const exportLayouts = useCallback<GridLayoutStoreValue['exportLayouts']>(
    () => Object.values(layouts).flat(),
    [layouts]
  );

  const value = useMemo<GridLayoutStoreValue>(
    () => ({ layouts, register, getLayouts, exportLayouts }),
    [layouts, register, getLayouts, exportLayouts]
  );

  return (
    <GridLayoutContext.Provider value={value}>
      {children}
    </GridLayoutContext.Provider>
  );
}

export function useGridLayoutRegistry(): GridLayoutStoreValue {
  const context = useContext(GridLayoutContext);
  if (!context) {
    throw new Error(
      'useGridLayoutRegistry must be used within a GridLayoutProvider'
    );
  }
  return context;
}
