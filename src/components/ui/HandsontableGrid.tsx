'use client';

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { HotTable } from '@handsontable/react';
import type { HotTableClass } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import '@/styles/handsontable-horizon-light.css';
import {
  Stack,
  Text,
  Button,
  Group,
  FileInput,
  TextInput,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconUpload, IconSearch } from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from './StatsCardGrid';
import { logger } from '@/lib/logger';

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

// Register Handsontable modules
registerAllModules();

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
  actionButtons?: React.ReactNode;
  searchRightButtons?: React.ReactNode;
  onCellClick?: (event: CellClickEvent<T>) => void;
  getCellData: GetCellData<T>;
  onCellEdited?: (edit: CellEditEvent<T>) => void;
  onSelectionSummaryChange?: (summary: SelectionSummary | null) => void;
  showFooter?: boolean;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  gridHeight?: number;
  className?: string;
  // scrollToLastNonEmptyRows removed
  stretchColumnId?: string;
}

export function HandsontableGrid<T extends object>({
  data,
  columns,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search...',
  statsCards = [],
  filteredData,
  enableCtrlF = false,
  enableCSVImport = false,
  onCSVImport,
  csvFile,
  onFileChange,
  actionButtons,
  searchRightButtons,
  onCellClick,
  getCellData,
  onCellEdited,
  onSelectionSummaryChange,
  showFooter = true,
  footerLeft,
  footerRight,
  gridHeight,
  className = '',
  // scrollToLastNonEmptyRows removed
  stretchColumnId,
}: HandsontableGridProps<T>) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hotRef = useRef<HotTableClass | null>(null);
  const columnsRef = useRef(columns);
  const [currentGridHeight, setCurrentGridHeight] = useState<number>(600);
  const cellClassMapRef = useRef(new Map<string, string>());
  const isBatchModeRef = useRef(false);
  const dropdownEditStateRef = useRef<{
    row: number;
    col: number;
    oldValue: string | number | null | undefined;
    selectionMade: boolean;
    cleanup?: () => void;
  } | null>(null);
  const lastSelectionSummaryRef = useRef<SelectionSummary | null>(null);

  // Debug: Check if theme is applied
  useEffect(() => {
    // SSR guard: Only run in browser environment
    if (typeof document === 'undefined') {
      return;
    }

    const wrapper = document.querySelector('.ht-theme-horizon');
    if (wrapper) {
      logger.debug('✅ Horizon theme wrapper found');
    } else {
      logger.debug('❌ Horizon theme wrapper NOT found');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track mouse interactions to cancel dropdowns when clicking outside
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const state = dropdownEditStateRef.current;
      if (!state) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest('.handsontableEditor .handsontable')) {
        state.selectionMade = true;
        return;
      }

      const editorContainer = document.querySelector('.handsontableEditor');
      if (editorContainer && editorContainer.contains(target)) {
        return;
      }

      const column = columnsRef.current[state.col];
      if (!column || column.type !== 'dropdown') {
        return;
      }

      const hotInstance = hotRef.current?.hotInstance;
      const activeEditor = hotInstance?.getActiveEditor() as unknown as {
        cancelChanges?: () => void;
        close?: () => void;
        isOpened?: () => boolean;
      } | null;

      try {
        activeEditor?.cancelChanges?.();
        if (activeEditor?.isOpened?.()) {
          activeEditor.close?.();
        }
      } catch (error) {
        logger.debug('Dropdown cancel on outside click failed', error);
      }

      dropdownEditStateRef.current?.cleanup?.();
      dropdownEditStateRef.current = null;
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () =>
      document.removeEventListener('mousedown', handleMouseDown, true);
  }, []);

  // Track Enter/Tab confirmations during dropdown editing
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const state = dropdownEditStateRef.current;
      if (!state) {
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        state.selectionMade = true;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const handleSelectionSummary = useCallback(
    (row: number, col: number, row2?: number, col2?: number) => {
      if (!onSelectionSummaryChange) {
        return;
      }

      if (
        typeof row !== 'number' ||
        typeof col !== 'number' ||
        row < 0 ||
        col < 0
      ) {
        if (lastSelectionSummaryRef.current) {
          lastSelectionSummaryRef.current = null;
          onSelectionSummaryChange(null);
        }
        return;
      }

      const hotInstance = hotRef.current?.hotInstance;
      if (!hotInstance) {
        if (lastSelectionSummaryRef.current) {
          lastSelectionSummaryRef.current = null;
          onSelectionSummaryChange(null);
        }
        return;
      }

      const startRow = Math.min(row, row2 ?? row);
      const endRow = Math.max(row, row2 ?? row);
      const startCol = Math.min(col, col2 ?? col);
      const endCol = Math.max(col, col2 ?? col);

      let numericCount = 0;
      let numericSum = 0;
      let textCount = 0;
      let cellCount = 0;

      for (let r = startRow; r <= endRow; r += 1) {
        for (let c = startCol; c <= endCol; c += 1) {
          const cellValue = hotInstance.getDataAtCell(r, c);

          if (cellValue === null || cellValue === undefined) {
            continue;
          }

          if (typeof cellValue === 'number') {
            if (!Number.isNaN(cellValue)) {
              cellCount += 1;
              numericCount += 1;
              numericSum += cellValue;
            }
            continue;
          }

          if (typeof cellValue === 'string') {
            const trimmed = cellValue.trim();
            if (!trimmed) {
              continue;
            }

            const normalized = Number(trimmed.replace(/,/g, ''));
            cellCount += 1;

            if (!Number.isNaN(normalized)) {
              numericCount += 1;
              numericSum += normalized;
            } else {
              textCount += 1;
            }
            continue;
          }

          if (typeof cellValue === 'boolean') {
            cellCount += 1;
            textCount += 1;
            continue;
          }

          const fallbackValue = String(cellValue).trim();
          if (fallbackValue) {
            cellCount += 1;
            textCount += 1;
          }
        }
      }

      const summary: SelectionSummary = {
        numericCount,
        numericSum,
        textCount,
        cellCount,
      };

      const previous = lastSelectionSummaryRef.current;
      const hasChanged =
        !previous ||
        previous.numericCount !== summary.numericCount ||
        previous.numericSum !== summary.numericSum ||
        previous.textCount !== summary.textCount ||
        previous.cellCount !== summary.cellCount;

      if (!hasChanged) {
        return;
      }

      lastSelectionSummaryRef.current = summary;
      onSelectionSummaryChange(summary);
    },
    [onSelectionSummaryChange]
  );

  const handleDeselect = useCallback(() => {
    if (!onSelectionSummaryChange) {
      return;
    }

    if (lastSelectionSummaryRef.current) {
      lastSelectionSummaryRef.current = null;
      onSelectionSummaryChange(null);
    }
  }, [onSelectionSummaryChange]);

  const handleBeforeStretch = useCallback(
    (stretchedWidth: number, column: number) => {
      if (!stretchColumnId) {
        return stretchedWidth;
      }

      const columnDef = columnsRef.current[column];
      if (!columnDef) {
        return stretchedWidth;
      }

      if (columnDef.id === stretchColumnId) {
        return stretchedWidth;
      }

      return columnDef.width ?? stretchedWidth;
    },
    [stretchColumnId]
  );

  // Apply header height styles dynamically
  useEffect(() => {
    // SSR guard: Only run in browser environment
    if (typeof document === 'undefined') {
      return;
    }

    const styleId = 'handsontable-header-height-styles';

    // Remove existing style if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create and inject new style
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .ht-theme-horizon .handsontable thead th,
      .ht-theme-horizon .handsontable .ht_clone_top thead th,
      .ht-theme-horizon .handsontable .ht_clone_top_left_corner thead th,
      .ht-theme-horizon .handsontable .ht_clone_left thead th {
  height: 55px !important;
  min-height: 55px !important;
  max-height: 55px !important;
  line-height: 55px !important;
        vertical-align: middle !important;
        display: table-cell !important;
        text-align: center !important;
        padding: 0 12px !important;
        box-sizing: border-box !important;
      }
      
      .ht-theme-horizon .handsontable thead th .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top thead th .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top_left_corner thead th .colHeader {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100% !important;
        line-height: 1 !important;
      }
      
      /* Target columns 6-9: UNIT PRICE, DISCOUNT, ADJUSTMENT, LINE TOTAL (right-align) */
      .ht-theme-horizon .handsontable thead th:nth-child(6),
      .ht-theme-horizon .handsontable thead th:nth-child(7),
      .ht-theme-horizon .handsontable thead th:nth-child(8),
      .ht-theme-horizon .handsontable thead th:nth-child(9),
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(6),
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(7),
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(8),
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(9) {
        text-align: right !important;
      }
      
      .ht-theme-horizon .handsontable thead th:nth-child(6) .colHeader,
      .ht-theme-horizon .handsontable thead th:nth-child(7) .colHeader,
      .ht-theme-horizon .handsontable thead th:nth-child(8) .colHeader,
      .ht-theme-horizon .handsontable thead th:nth-child(9) .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(6) .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(7) .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(8) .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top thead th:nth-child(9) .colHeader {
        justify-content: flex-end !important;
      }
      
      /* Remove grey background from read-only cells */
      .ht-theme-horizon .handsontable td.htDimmed {
        background-color: #ffffff !important;
        color: inherit !important;
      }
      
      .ht-theme-horizon .handsontable td.htDimmed.area {
        background-color: #d9f0fc !important;
      }
    `;
    document.head.appendChild(style);

    // Cleanup function
    return () => {
      const styleToRemove = document.getElementById(styleId);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, []);

  // Set grid height to 84vh by default
  useEffect(() => {
    // SSR guard: Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    const updateGridHeight = () => {
      const targetHeight = gridHeight || window.innerHeight * 0.8;
      setCurrentGridHeight(targetHeight);
    };

    updateGridHeight();
    const handleResize = () => updateGridHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridHeight]);

  // Handle Ctrl+F to focus search bar
  useEffect(() => {
    if (!enableCtrlF) {
      return;
    }

    // SSR guard: Only run in browser environment
    if (typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        event.stopPropagation(); // Stop event from reaching other handlers

        // Close any active cell editor in Handsontable
        if (hotRef.current) {
          const hotInstance = hotRef.current.hotInstance;
          if (hotInstance) {
            hotInstance.deselectCell(); // Exit edit mode and deselect cell
          }
        }

        // Small delay to ensure cell editor is closed before focusing search
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 10);
      }
    };

    // Use capture phase to intercept before Handsontable
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [enableCtrlF]);

  // Google Sheets-style Ctrl+Arrow navigation
  useEffect(() => {
    if (!hotRef.current) {
      return;
    }

    // SSR guard: Only run in browser environment
    if (typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Ctrl+Arrow keys (or Cmd+Arrow on Mac)
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (
        !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        return;
      }

      const hotInstance = hotRef.current?.hotInstance;
      if (!hotInstance) {
        return;
      }

      // Get current selection
      const selected = hotInstance.getSelected();
      if (!selected || selected.length === 0) {
        return;
      }

      const [startRow, startCol] = selected[0];

      event.preventDefault();
      event.stopPropagation();

      let targetRow = startRow;
      let targetCol = startCol;

      // Helper function to check if a cell is empty
      const isCellEmpty = (row: number, col: number): boolean => {
        const value = hotInstance.getDataAtCell(row, col);
        return value === null || value === undefined || value === '';
      };

      if (event.key === 'ArrowDown') {
        // Move down to next non-empty cell or last non-empty cell
        const maxRow = hotInstance.countRows() - 1;
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to next non-empty cell
          for (let row = startRow + 1; row <= maxRow; row++) {
            if (!isCellEmpty(row, startCol)) {
              targetRow = row;
              break;
            }
          }
          // If no non-empty cell found, jump to last row
          if (targetRow === startRow) {
            targetRow = maxRow;
          }
        } else {
          // If current cell is non-empty, find the last consecutive non-empty cell
          let lastNonEmpty = startRow;
          for (let row = startRow + 1; row <= maxRow; row++) {
            if (!isCellEmpty(row, startCol)) {
              lastNonEmpty = row;
            } else {
              break;
            }
          }

          if (lastNonEmpty > startRow) {
            // Found consecutive non-empty cells, jump to the last one
            targetRow = lastNonEmpty;
          } else {
            // Next cell is empty, jump to next non-empty cell or end
            for (let row = startRow + 1; row <= maxRow; row++) {
              if (!isCellEmpty(row, startCol)) {
                targetRow = row;
                break;
              }
            }
            // If no non-empty cell found, jump to last row
            if (targetRow === startRow) {
              targetRow = maxRow;
            }
          }
        }
      } else if (event.key === 'ArrowUp') {
        // Move up to previous non-empty cell or first non-empty cell
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to previous non-empty cell
          for (let row = startRow - 1; row >= 0; row--) {
            if (!isCellEmpty(row, startCol)) {
              targetRow = row;
              break;
            }
          }
          // If no non-empty cell found, jump to first row
          if (targetRow === startRow) {
            targetRow = 0;
          }
        } else {
          // If current cell is non-empty, find the first consecutive non-empty cell
          let firstNonEmpty = startRow;
          for (let row = startRow - 1; row >= 0; row--) {
            if (!isCellEmpty(row, startCol)) {
              firstNonEmpty = row;
            } else {
              break;
            }
          }

          if (firstNonEmpty < startRow) {
            // Found consecutive non-empty cells, jump to the first one
            targetRow = firstNonEmpty;
          } else {
            // Previous cell is empty, jump to previous non-empty cell or beginning
            for (let row = startRow - 1; row >= 0; row--) {
              if (!isCellEmpty(row, startCol)) {
                targetRow = row;
                break;
              }
            }
            // If no non-empty cell found, jump to first row
            if (targetRow === startRow) {
              targetRow = 0;
            }
          }
        }
      } else if (event.key === 'ArrowRight') {
        // Move right to next non-empty cell or last non-empty cell
        const maxCol = hotInstance.countCols() - 1;
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to next non-empty cell
          for (let col = startCol + 1; col <= maxCol; col++) {
            if (!isCellEmpty(startRow, col)) {
              targetCol = col;
              break;
            }
          }
          // If no non-empty cell found, jump to last column
          if (targetCol === startCol) {
            targetCol = maxCol;
          }
        } else {
          // If current cell is non-empty, find the last consecutive non-empty cell
          let lastNonEmpty = startCol;
          for (let col = startCol + 1; col <= maxCol; col++) {
            if (!isCellEmpty(startRow, col)) {
              lastNonEmpty = col;
            } else {
              break;
            }
          }

          if (lastNonEmpty > startCol) {
            // Found consecutive non-empty cells, jump to the last one
            targetCol = lastNonEmpty;
          } else {
            // Next cell is empty, jump to next non-empty cell or end
            for (let col = startCol + 1; col <= maxCol; col++) {
              if (!isCellEmpty(startRow, col)) {
                targetCol = col;
                break;
              }
            }
            // If no non-empty cell found, jump to last column
            if (targetCol === startCol) {
              targetCol = maxCol;
            }
          }
        }
      } else if (event.key === 'ArrowLeft') {
        // Move left to previous non-empty cell or first non-empty cell
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to previous non-empty cell
          for (let col = startCol - 1; col >= 0; col--) {
            if (!isCellEmpty(startRow, col)) {
              targetCol = col;
              break;
            }
          }
          // If no non-empty cell found, jump to first column
          if (targetCol === startCol) {
            targetCol = 0;
          }
        } else {
          // If current cell is non-empty, find the first consecutive non-empty cell
          let firstNonEmpty = startCol;
          for (let col = startCol - 1; col >= 0; col--) {
            if (!isCellEmpty(startRow, col)) {
              firstNonEmpty = col;
            } else {
              break;
            }
          }

          if (firstNonEmpty < startCol) {
            // Found consecutive non-empty cells, jump to the first one
            targetCol = firstNonEmpty;
          } else {
            // Previous cell is empty, jump to previous non-empty cell or beginning
            for (let col = startCol - 1; col >= 0; col--) {
              if (!isCellEmpty(startRow, col)) {
                targetCol = col;
                break;
              }
            }
            // If no non-empty cell found, jump to first column
            if (targetCol === startCol) {
              targetCol = 0;
            }
          }
        }
      }

      // Select the target cell
      hotInstance.selectCell(targetRow, targetCol);
    };

    // Use capture phase to intercept before Handsontable's default behavior
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Convert columns to Handsontable format
  const hotColumns = useMemo(() => {
    return columns.map((col, colIndex) => {
      const alignmentClass =
        col.align === 'right'
          ? 'htRight'
          : col.align === 'center'
            ? 'htCenter'
            : 'htLeft';

      const columnClassName = [alignmentClass, col.className]
        .filter(Boolean)
        .join(' ');

      if (col.type === 'dropdown') {
        return {
          data: colIndex,
          type: 'autocomplete',
          source: col.dropdownValues ?? [],
          strict: true,
          allowInvalid: false,
          allowEmpty: true,
          title: col.title,
          width: col.width ?? 120,
          className: columnClassName,
          readOnly: Boolean(col.readOnly),
        };
      }

      const columnConfig: {
        data: number;
        type: 'text' | 'numeric';
        title: string;
        width: number;
        className: string;
        numericFormat?: { pattern: string };
        readOnly: boolean;
      } = {
        data: colIndex,
        type: col.type === 'numeric' ? 'numeric' : 'text',
        title: col.title,
        width: col.width ?? 120,
        className: columnClassName,
        readOnly: Boolean(col.readOnly),
      };

      if (col.type === 'numeric' && col.numericFormat) {
        columnConfig.numericFormat = { pattern: col.numericFormat };
      }

      return columnConfig;
    });
  }, [columns]);

  // Convert data to 2D array format for Handsontable
  const hotData = useMemo(() => {
    const classMap = new Map<string, string>();

    const dataMatrix = filteredData.map((rowData, rowIndex) => {
      return columns.map((col, colIndex) => {
        const cell = getCellData({ column: col, row: rowIndex, rowData });

        if (cell?.className) {
          classMap.set(`${rowIndex}-${colIndex}`, cell.className);
        }

        if (!cell) {
          return '';
        }

        const resolvedDisplay = cell.displayValue ?? cell.value;

        if (col.type === 'numeric') {
          if (
            resolvedDisplay === null ||
            resolvedDisplay === undefined ||
            resolvedDisplay === ''
          ) {
            return '';
          }

          if (typeof resolvedDisplay === 'number') {
            return resolvedDisplay;
          }

          const numericValue = Number(
            String(resolvedDisplay).replace(/,/g, '')
          );

          if (Number.isFinite(numericValue)) {
            return numericValue;
          }

          return String(resolvedDisplay);
        }

        if (resolvedDisplay === null || resolvedDisplay === undefined) {
          return '';
        }

        return String(resolvedDisplay);
      });
    });

    cellClassMapRef.current = classMap;
    return dataMatrix;
  }, [filteredData, columns, getCellData]);

  // Auto-scroll to last non-empty row feature removed
  const handleCSVImport = async () => {
    if (!csvFile || !onCSVImport) {
      return;
    }

    try {
      await onCSVImport(csvFile);
    } catch (error) {
      logger.error('CSV import error:', error);
      showNotification({
        title: '❌ Import Failed',
        message: 'Failed to parse CSV file. Please check the file format.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  return (
    <Stack
      gap="md"
      className={className}
      style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
    >
      {/* Stats cards */}
      {statsCards && statsCards.length > 0 && (
        <StatsCardGrid
          cards={statsCards}
          variant="vibrant"
          minCardWidth={220}
          spacing="md"
        />
      )}

      {/* Search and controls */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <Group gap="md" style={{ flex: 1 }}>
          <TextInput
            ref={searchInputRef}
            placeholder={
              enableCtrlF ? `${searchPlaceholder} (Ctrl+F)` : searchPlaceholder
            }
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 300,
            }}
            styles={{
              input: {
                backgroundColor: '#ffffff',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: '1px',
                borderStyle: 'solid',
                color: '#333333',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                '&::placeholder': {
                  color: '#999999',
                },
                '&:focus': {
                  borderColor: '#667eea',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                },
              },
            }}
            size="md"
            radius="md"
          />
          {searchRightButtons}
        </Group>

        {(enableCSVImport || actionButtons) && (
          <Group gap="sm">
            {enableCSVImport && (
              <>
                <FileInput
                  placeholder="Select CSV file"
                  leftSection={<IconUpload size={16} />}
                  value={csvFile}
                  onChange={onFileChange}
                  accept=".csv"
                  size="md"
                  radius="md"
                />
                <Button
                  onClick={handleCSVImport}
                  disabled={!csvFile}
                  size="md"
                  radius="md"
                >
                  Import
                </Button>
              </>
            )}
            {actionButtons}
          </Group>
        )}
      </Group>

      {/* Handsontable Grid */}
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <HotTable
          ref={hotRef}
          themeName="ht-theme-horizon"
          data={hotData}
          columns={hotColumns}
          colHeaders={columns.map((col) => col.title)}
          rowHeaders={true}
          width="100%"
          height={currentGridHeight - 40}
          licenseKey="non-commercial-and-evaluation"
          // Performance optimizations for large datasets (4795 rows)
          renderAllRows={false} // Virtual rendering - only render visible rows
          renderAllColumns={false} // Virtual rendering - only render visible columns
          viewportRowRenderingOffset={30} // Render 30 extra rows above/below viewport
          viewportColumnRenderingOffset={5} // Render 5 extra columns left/right
          // Styling
          stretchH={stretchColumnId ? 'all' : 'none'}
          beforeStretchingColumnWidth={handleBeforeStretch}
          autoWrapRow={false}
          autoWrapCol={false}
          // Features
          manualColumnResize={true}
          manualRowResize={true}
          contextMenu={[]}
          filters={true}
          dropdownMenu={false}
          // Performance: Disable features that slow down large grids
          autoRowSize={false} // Disable auto row height calculation
          autoColumnSize={false} // Disable auto column width calculation
          rowHeights={45} // Set fixed row height
          columnHeaderHeight={45} // Set header height to match row height
          minSpareRows={20} // Keep 20 empty rows available for fast entry
          cells={(_row, _col) => {
            return {
              renderer: (
                instance,
                td,
                rowIndex,
                colIndex,
                prop,
                value,
                cellProperties
              ) => {
                const rendererType =
                  typeof cellProperties?.type === 'string'
                    ? cellProperties.type
                    : 'text';
                const baseRenderer =
                  Handsontable.renderers.getRenderer(rendererType);

                baseRenderer(
                  instance,
                  td,
                  rowIndex,
                  colIndex,
                  prop,
                  value,
                  cellProperties
                );

                const setStyle = (property: string, value?: string) => {
                  if (value) {
                    td.style.setProperty(property, value, 'important');
                  } else {
                    td.style.removeProperty(property);
                  }
                };

                td.classList.remove(
                  'ht-due-status-today',
                  'ht-due-status-past'
                );

                if (rowIndex >= 0 && colIndex >= 0) {
                  const className = cellClassMapRef.current.get(
                    `${rowIndex}-${colIndex}`
                  );
                  if (className) {
                    td.classList.add(className);
                    if (className === 'ht-due-status-today') {
                      setStyle('background-color', 'rgba(251, 146, 60, 0.14)');
                      setStyle('color', '#b45309');
                      td.style.fontWeight = '600';
                    } else if (className === 'ht-due-status-past') {
                      setStyle('background-color', 'rgba(248, 113, 113, 0.14)');
                      setStyle('color', '#b91c1c');
                      td.style.fontWeight = '600';
                    } else {
                      setStyle('background-color');
                      setStyle('color');
                      td.style.fontWeight = '';
                    }
                  } else {
                    setStyle('background-color');
                    setStyle('color');
                    td.style.fontWeight = '';
                  }
                } else {
                  setStyle('background-color');
                  setStyle('color');
                  td.style.fontWeight = '';
                }
              },
            };
          }}
          beforeCut={() => false}
          afterBeginEditing={(row, col) => {
            const column = columns[col];

            if (!column || column.type !== 'dropdown') {
              dropdownEditStateRef.current?.cleanup?.();
              dropdownEditStateRef.current = null;
              return;
            }

            const hotInstance = hotRef.current?.hotInstance;
            const currentValue = hotInstance?.getDataAtCell(row, col);

            dropdownEditStateRef.current?.cleanup?.();

            const state = {
              row,
              col,
              oldValue: currentValue,
              selectionMade: false,
              cleanup: undefined as (() => void) | undefined,
            };

            dropdownEditStateRef.current = state;

            requestAnimationFrame(() => {
              const activeInstance = hotRef.current?.hotInstance;
              const editor = activeInstance?.getActiveEditor() as unknown as {
                TEXTAREA?: HTMLTextAreaElement;
                htEditor?: {
                  deselectCell?: () => void;
                  selectCell?: (...coords: number[]) => void;
                  getSelectedLast?: () => number[] | undefined;
                };
              } | null;

              try {
                editor?.htEditor?.deselectCell?.();
              } catch (error) {
                logger.debug('Dropdown deselect failed', error);
              }

              if (editor?.htEditor?.getSelectedLast?.()) {
                try {
                  editor.htEditor.selectCell?.(-1, -1);
                } catch (error) {
                  logger.debug('Dropdown fallback deselect failed', error);
                }
              }

              const inputEl = editor?.TEXTAREA;
              if (inputEl) {
                const handleInput = () => {
                  if (dropdownEditStateRef.current === state) {
                    state.selectionMade = true;
                  }
                };

                inputEl.addEventListener('input', handleInput);
                state.cleanup = () => {
                  inputEl.removeEventListener('input', handleInput);
                };
              }
            });
          }}
          beforeChange={(changes) => {
            if (!changes || !dropdownEditStateRef.current) {
              return;
            }

            const state = dropdownEditStateRef.current;

            if (state.selectionMade) {
              return;
            }

            changes.forEach((change) => {
              if (!change) {
                return;
              }

              const [changeRow, changeCol, oldValue] = change;

              if (
                changeRow === state.row &&
                changeCol === state.col &&
                columns[changeCol]?.type === 'dropdown'
              ) {
                change[3] = oldValue;
              }
            });
          }}
          afterChange={(changes, source) => {
            if (!changes || !onCellEdited) {
              dropdownEditStateRef.current?.cleanup?.();
              dropdownEditStateRef.current = null;
              return;
            }

            const changeSource = source ?? 'edit';

            logger.debug('📝 afterChange triggered:', {
              source: changeSource,
              changesCount: changes.length,
            });

            const isPaste =
              changeSource.includes('paste') ||
              changeSource.includes('Paste') ||
              changeSource.includes('Autofill');

            const isBatchEdit = changes.length > 5 && changeSource === 'edit';
            const isBatchOperation = isPaste || isBatchEdit;

            const processChange = (
              row: number,
              col: number,
              oldValue: unknown,
              newValue: unknown,
              isBatch: boolean
            ): Promise<boolean> => {
              if (oldValue === newValue || typeof col !== 'number') {
                return Promise.resolve(false);
              }

              const column = columns[col];
              const rowData = filteredData[row];

              if (!column || !rowData) {
                return Promise.resolve(false);
              }

              const normalizedNewValue =
                newValue === null || newValue === undefined
                  ? ''
                  : String(newValue);

              const normalizedOldValue =
                oldValue === null || oldValue === undefined
                  ? null
                  : String(oldValue);

              try {
                const result = onCellEdited({
                  column,
                  columnId: column.id,
                  columnIndex: col,
                  row,
                  rowData,
                  value: normalizedNewValue,
                  oldValue: normalizedOldValue,
                  isBatch,
                  source: changeSource,
                });

                const maybePromise = result as Promise<unknown> | undefined;
                if (maybePromise && typeof maybePromise.then === 'function') {
                  return maybePromise
                    .then(() => true)
                    .catch((error) => {
                      logger.error(
                        'Cell edit failed during batch operation',
                        error
                      );
                      return false;
                    });
                }

                return Promise.resolve(true);
              } catch (error) {
                logger.error(
                  'Cell edit threw synchronously during batch operation',
                  error
                );
                return Promise.resolve(false);
              }
            };

            logger.debug('🔍 Batch detection:', {
              source: changeSource,
              changesCount: changes.length,
              isPaste,
              isBatchEdit,
              isBatchOperation,
            });

            if (isBatchOperation) {
              logger.debug('🚀 BATCH MODE: start');
              isBatchModeRef.current = true;
              window.dispatchEvent(new CustomEvent('handsontable-batch-start'));

              const changePromises = changes.map(
                ([row, col, oldValue, newValue]) =>
                  processChange(row, col as number, oldValue, newValue, true)
              );

              Promise.all(changePromises)
                .then((results) => {
                  const processedCells = results.filter(Boolean).length;
                  window.dispatchEvent(
                    new CustomEvent('handsontable-batch-complete', {
                      detail: { count: processedCells },
                    })
                  );
                })
                .catch((error) => {
                  logger.error('Batch processing encountered an error', error);
                  window.dispatchEvent(
                    new CustomEvent('handsontable-batch-complete', {
                      detail: { count: 0 },
                    })
                  );
                })
                .finally(() => {
                  isBatchModeRef.current = false;
                });
            } else {
              changes.forEach(([row, col, oldValue, newValue]) => {
                void processChange(
                  row,
                  col as number,
                  oldValue,
                  newValue,
                  false
                );
              });
            }

            dropdownEditStateRef.current?.cleanup?.();
            dropdownEditStateRef.current = null;
          }}
          afterSelection={(row, col, row2, col2) => {
            handleSelectionSummary(row, col, row2, col2);
          }}
          afterSelectionEnd={(row, col, row2, col2) => {
            handleSelectionSummary(row, col, row2, col2);

            if (!onCellClick) {
              return;
            }

            const targetRow = typeof row2 === 'number' ? row2 : row;
            const targetCol = typeof col2 === 'number' ? col2 : col;

            if (targetRow === undefined || targetCol === undefined) {
              return;
            }

            if (targetRow < 0 || targetCol < 0) {
              return;
            }

            const rowData = filteredData[targetRow];
            const column = columns[targetCol];

            if (!rowData || !column) {
              return;
            }

            onCellClick({
              column,
              columnIndex: targetCol,
              row: targetRow,
              rowData,
            });
          }}
          afterDeselect={handleDeselect}
        />
      </div>

      {/* Footer pagination counter at bottom */}
      {showFooter && (
        <Group
          justify="space-between"
          align="center"
          style={{ marginTop: 'md' }}
        >
          <div>
            {footerLeft || (
              <Text size="sm" c="dimmed">
                {`Showing ${filteredData.length} of ${data.length} items`}
              </Text>
            )}
          </div>
          {footerRight && (
            <div>
              {typeof footerRight === 'string' ? (
                <Text size="sm" c="dimmed">
                  {footerRight}
                </Text>
              ) : (
                footerRight
              )}
            </div>
          )}
        </Group>
      )}
    </Stack>
  );
}
