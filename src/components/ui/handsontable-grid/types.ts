'use client';

import type { ReactNode } from 'react';
import type { StatCard } from '../StatsCardGrid';

export type TableColumnAlignment = 'left' | 'center' | 'right';
export type HandsontableColumnType = 'text' | 'numeric' | 'dropdown';

export interface HandsontableColumn {
  id: string;
  title: string;
  width?: number;
  align?: TableColumnAlignment;
  type?: HandsontableColumnType;
  dropdownValues?: string[];
  readOnly?: boolean;
  numericFormat?: string;
  className?: string;
}

export interface CellData {
  value: string | number | null | undefined;
  displayValue?: string;
  readOnly?: boolean;
  className?: string;
}

export interface CellEditEvent<T> {
  column: HandsontableColumn;
  columnId: string;
  columnIndex: number;
  row: number;
  rowData: T;
  value: string;
  oldValue: string | null;
  isBatch: boolean;
  source: string;
}

export type GetCellData<T> = (params: {
  column: HandsontableColumn;
  row: number;
  rowData: T;
}) => CellData;

export interface CellClickEvent<T> {
  column: HandsontableColumn;
  columnIndex: number;
  row: number;
  rowData: T;
}

export interface SelectionSummary {
  numericCount: number;
  numericSum: number;
  textCount: number;
  cellCount: number;
}

export interface HandsontableGridProps<T extends object> {
  data: readonly T[];
  columns: readonly HandsontableColumn[];
  searchQuery: string;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
  statsCards?: StatCard[];
  filteredData: readonly T[];
  enableCtrlF?: boolean;
  enableCSVImport?: boolean;
  onCSVImport?: (file: File) => Promise<void>;
  csvFile: File | null;
  onFileChange: (file: File | null) => void;
  actionButtons?: ReactNode;
  secondarySearchControl?: ReactNode;
  searchRightButtons?: ReactNode;
  searchBottomContent?: ReactNode;
  stackActionsBelowSearch?: boolean;
  onCellClick?: (event: CellClickEvent<T>) => void;
  getCellData: GetCellData<T>;
  onCellEdited?: (
    edit: CellEditEvent<T>
  ) => void | boolean | Promise<void | boolean>;
  onSelectionSummaryChange?: (summary: SelectionSummary | null) => void;
  showFooter?: boolean;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  gridHeight?: number;
  className?: string;
  stretchColumnId?: string;
}
