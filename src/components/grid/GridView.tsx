'use client';

import React, { forwardRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { GridCell, GridColumn, Item } from '@glideapps/glide-data-grid';
import { useGridAdapter } from './GridAdapterContext';
import { useGridLayoutRegistry } from './GridLayoutStore';

export interface GridViewProps {
  columns: GridColumn[];
  rows: number;
  getCellContent: (cell: Item) => GridCell;
  height: number;
  width?: number | string;
  rowHeight?: number;
  headerHeight?: number;
  [key: string]: unknown;
}

function sanitiseColumns(columns: GridColumn[]) {
  return columns.map((column) => ({
    id: 'id' in column ? column.id : undefined,
    title: column.title ?? '',
    width: 'width' in column ? column.width : undefined,
    grow: 'grow' in column ? column.grow : undefined,
    align:
      'align' in column && typeof column.align === 'string'
        ? column.align
        : undefined,
  }));
}

export const GridView = forwardRef<unknown, GridViewProps>((props, ref) => {
  const columns = props.columns as GridColumn[];
  const rowHeight = props.rowHeight as number | undefined;
  const headerHeight = props.headerHeight as number | undefined;
  const adapter = useGridAdapter();
  const { register } = useGridLayoutRegistry();
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    let snapshotColumns: GridColumn[];
    if (adapter.normaliseColumns) {
      snapshotColumns = adapter.normaliseColumns(columns) as GridColumn[];
    } else {
      snapshotColumns = columns;
    }

    register(pathname, {
      adapter: adapter.name,
      columns: sanitiseColumns(snapshotColumns),
      settings: {
        rowHeight: typeof rowHeight === 'number' ? rowHeight : undefined,
        headerHeight:
          typeof headerHeight === 'number' ? headerHeight : undefined,
      },
    });
  }, [adapter, columns, headerHeight, pathname, register, rowHeight]);

  const AdapterComponent = adapter.Component;

  return (
    <AdapterComponent
      ref={ref as React.Ref<unknown>}
      {...(props as GridViewProps)}
    />
  );
});

GridView.displayName = 'GridView';
