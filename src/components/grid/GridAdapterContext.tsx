'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { GridViewProps } from './GridView';
import { glideGridAdapter } from './GlideGridAdapter';

export interface GridAdapter {
  /**
   * Human friendly identifier for the adapter. Stored with layout snapshots so
   * we can tell which grid implementation produced them.
   */
  name: string;
  /**
   * React component used to render the grid. It receives the same props that
   * callers pass into {@link GridView}.
   */
  Component: React.ComponentType<GridViewProps>;
  /**
   * Optional hook to normalise column data before it is persisted.
   */
  normaliseColumns?: (
    columns: GridViewProps['columns']
  ) => GridViewProps['columns'];
}

const GridAdapterContext = createContext<GridAdapter>(glideGridAdapter);

export interface GridAdapterProviderProps {
  adapter?: GridAdapter;
  children: React.ReactNode;
}

export function GridAdapterProvider({
  adapter,
  children,
}: GridAdapterProviderProps) {
  const value = useMemo(() => adapter ?? glideGridAdapter, [adapter]);
  return (
    <GridAdapterContext.Provider value={value}>
      {children}
    </GridAdapterContext.Provider>
  );
}

export function useGridAdapter(): GridAdapter {
  return useContext(GridAdapterContext);
}
