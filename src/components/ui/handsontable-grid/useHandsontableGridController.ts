'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import type { HotTableClass } from '@handsontable/react';
import Handsontable from 'handsontable';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import {
  buildSelectionSummaryBounds,
  calculateSelectionSummary,
  hasSelectionSummaryChanged,
} from '../handsontableSelectionSummary';
import type { HandsontableGridProps, SelectionSummary } from './types';

type DropdownCancelEditor = {
  cancelChanges?: () => void;
  close?: () => void;
  isOpened?: () => boolean;
};

type DropdownSelectionEditor = {
  TEXTAREA?: HTMLTextAreaElement;
  htEditor?: {
    deselectCell?: () => void;
    selectCell?: (...coords: number[]) => void;
    getSelectedLast?: () => number[] | undefined;
  };
};

const getActiveEditor = <TEditor extends object>(
  instance: Handsontable | null | undefined
): TEditor | null => {
  const rawEditor = instance?.getActiveEditor();
  return rawEditor && typeof rawEditor === 'object'
    ? (rawEditor as TEditor)
    : null;
};

type ControllerProps<T extends object> = Pick<
  HandsontableGridProps<T>,
  | 'columns'
  | 'filteredData'
  | 'getCellData'
  | 'onCSVImport'
  | 'csvFile'
  | 'onSelectionSummaryChange'
  | 'stretchColumnId'
  | 'gridHeight'
  | 'enableCtrlF'
  | 'onCellEdited'
  | 'onCellClick'
>;

type BeforeChangeHandler = NonNullable<GridSettings['beforeChange']>;
type AfterChangeHandler = NonNullable<GridSettings['afterChange']>;
type BaseRenderer = typeof Handsontable.renderers.BaseRenderer;
type CellChange = Handsontable.CellChange;
type ChangeSource = Handsontable.ChangeSource;
type CellProperties = Handsontable.CellProperties;
type ColumnSettings = Handsontable.ColumnSettings;
type GridSettings = Handsontable.GridSettings;
type CoreInstance = Handsontable;

export function useHandsontableGridController<T extends object>({
  columns,
  filteredData,
  getCellData,
  onCSVImport,
  csvFile,
  onSelectionSummaryChange,
  stretchColumnId,
  gridHeight,
  enableCtrlF,
  onCellEdited,
  onCellClick,
}: ControllerProps<T>) {
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

  const handleSearchFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      event.target.select();
    },
    []
  );

  const revertCell = useCallback(
    (row: number, col: number, oldValue: unknown) => {
      const instance = hotRef.current?.hotInstance;
      if (!instance) {
        return;
      }

      instance.setDataAtCell(row, col, oldValue ?? '', 'revert');
    },
    []
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const wrapper = document.querySelector('.ht-theme-horizon');
    if (wrapper) {
      logger.debug('✅ Horizon theme wrapper found');
    } else {
      logger.debug('❌ Horizon theme wrapper NOT found');
    }
  }, []);

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
      const activeEditor = getActiveEditor<DropdownCancelEditor>(hotInstance);

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

      const bounds = buildSelectionSummaryBounds({ row, col, row2, col2 });
      if (!bounds.valid) {
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

      const summary = calculateSelectionSummary({
        startRow: bounds.startRow,
        endRow: bounds.endRow,
        startCol: bounds.startCol,
        endCol: bounds.endCol,
        getDataAtCell: (summaryRow, summaryCol) =>
          hotInstance.getDataAtCell(summaryRow, summaryCol),
      });

      if (
        !hasSelectionSummaryChanged(lastSelectionSummaryRef.current, summary)
      ) {
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
        const baseWidth = columnDef.width ?? stretchedWidth;
        return Math.min(stretchedWidth, baseWidth + 160);
      }

      return columnDef.width ?? stretchedWidth;
    },
    [stretchColumnId]
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const styleId = 'handsontable-header-height-styles';
    document.getElementById(styleId)?.remove();

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

      .ht-theme-horizon .handsontable td.htDimmed {
        background-color: #ffffff !important;
        color: inherit !important;
      }

      .ht-theme-horizon .handsontable td.htDimmed.area {
        background-color: #d9f0fc !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateGridHeight = () => {
      setCurrentGridHeight(gridHeight || window.innerHeight * 0.8);
    };

    updateGridHeight();
    window.addEventListener('resize', updateGridHeight);
    return () => window.removeEventListener('resize', updateGridHeight);
  }, [gridHeight]);

  useEffect(() => {
    if (!enableCtrlF || typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        (event.key.toLowerCase() === 'f' || event.code === 'KeyF');

      if (!isFindShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      hotRef.current?.hotInstance?.deselectCell();

      setTimeout(() => {
        const fallbackSearchInput =
          searchInputRef.current ??
          (document.querySelector(
            'input[placeholder*="Ctrl+F"], input[placeholder*="Search"]'
          ) as HTMLInputElement | null);

        fallbackSearchInput?.focus();
        fallbackSearchInput?.select();
      }, 10);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [enableCtrlF]);

  useEffect(() => {
    if (!hotRef.current || typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
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

      const selected = hotInstance.getSelected();
      if (!selected || selected.length === 0) {
        return;
      }

      const [startRow, startCol] = selected[0];
      let targetRow = startRow;
      let targetCol = startCol;

      const isCellEmpty = (row: number, col: number) => {
        const value = hotInstance.getDataAtCell(row, col);
        return value === null || value === undefined || value === '';
      };

      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'ArrowDown') {
        const maxRow = hotInstance.countRows() - 1;
        const currentEmpty = isCellEmpty(startRow, startCol);
        if (currentEmpty) {
          for (let row = startRow + 1; row <= maxRow; row += 1) {
            if (!isCellEmpty(row, startCol)) {
              targetRow = row;
              break;
            }
          }
          if (targetRow === startRow) {
            targetRow = maxRow;
          }
        } else {
          let lastNonEmpty = startRow;
          for (let row = startRow + 1; row <= maxRow; row += 1) {
            if (!isCellEmpty(row, startCol)) {
              lastNonEmpty = row;
            } else {
              break;
            }
          }
          if (lastNonEmpty > startRow) {
            targetRow = lastNonEmpty;
          } else {
            for (let row = startRow + 1; row <= maxRow; row += 1) {
              if (!isCellEmpty(row, startCol)) {
                targetRow = row;
                break;
              }
            }
            if (targetRow === startRow) {
              targetRow = maxRow;
            }
          }
        }
      } else if (event.key === 'ArrowUp') {
        const currentEmpty = isCellEmpty(startRow, startCol);
        if (currentEmpty) {
          for (let row = startRow - 1; row >= 0; row -= 1) {
            if (!isCellEmpty(row, startCol)) {
              targetRow = row;
              break;
            }
          }
          if (targetRow === startRow) {
            targetRow = 0;
          }
        } else {
          let firstNonEmpty = startRow;
          for (let row = startRow - 1; row >= 0; row -= 1) {
            if (!isCellEmpty(row, startCol)) {
              firstNonEmpty = row;
            } else {
              break;
            }
          }
          if (firstNonEmpty < startRow) {
            targetRow = firstNonEmpty;
          } else {
            for (let row = startRow - 1; row >= 0; row -= 1) {
              if (!isCellEmpty(row, startCol)) {
                targetRow = row;
                break;
              }
            }
            if (targetRow === startRow) {
              targetRow = 0;
            }
          }
        }
      } else if (event.key === 'ArrowRight') {
        const maxCol = hotInstance.countCols() - 1;
        const currentEmpty = isCellEmpty(startRow, startCol);
        if (currentEmpty) {
          for (let col = startCol + 1; col <= maxCol; col += 1) {
            if (!isCellEmpty(startRow, col)) {
              targetCol = col;
              break;
            }
          }
          if (targetCol === startCol) {
            targetCol = maxCol;
          }
        } else {
          let lastNonEmpty = startCol;
          for (let col = startCol + 1; col <= maxCol; col += 1) {
            if (!isCellEmpty(startRow, col)) {
              lastNonEmpty = col;
            } else {
              break;
            }
          }
          if (lastNonEmpty > startCol) {
            targetCol = lastNonEmpty;
          } else {
            for (let col = startCol + 1; col <= maxCol; col += 1) {
              if (!isCellEmpty(startRow, col)) {
                targetCol = col;
                break;
              }
            }
            if (targetCol === startCol) {
              targetCol = maxCol;
            }
          }
        }
      } else if (event.key === 'ArrowLeft') {
        const currentEmpty = isCellEmpty(startRow, startCol);
        if (currentEmpty) {
          for (let col = startCol - 1; col >= 0; col -= 1) {
            if (!isCellEmpty(startRow, col)) {
              targetCol = col;
              break;
            }
          }
          if (targetCol === startCol) {
            targetCol = 0;
          }
        } else {
          let firstNonEmpty = startCol;
          for (let col = startCol - 1; col >= 0; col -= 1) {
            if (!isCellEmpty(startRow, col)) {
              firstNonEmpty = col;
            } else {
              break;
            }
          }
          if (firstNonEmpty < startCol) {
            targetCol = firstNonEmpty;
          } else {
            for (let col = startCol - 1; col >= 0; col -= 1) {
              if (!isCellEmpty(startRow, col)) {
                targetCol = col;
                break;
              }
            }
            if (targetCol === startCol) {
              targetCol = 0;
            }
          }
        }
      }

      hotInstance.selectCell(targetRow, targetCol);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const hotColumns = useMemo<ColumnSettings[]>(() => {
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
        const dropdownValues = col.dropdownValues ?? [];
        const source =
          col.dropdownSearchMode === 'contains'
            ? (
                query: string,
                process: (matches: string[]) => void
              ): void => {
                const normalizedQuery = query.trim().toLowerCase();

                if (!normalizedQuery) {
                  process(dropdownValues);
                  return;
                }

                process(
                  dropdownValues.filter((value) =>
                    value.toLowerCase().includes(normalizedQuery)
                  )
                );
              }
            : dropdownValues;

        return {
          data: colIndex,
          type: 'dropdown',
          source,
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
          return Number.isFinite(numericValue)
            ? numericValue
            : String(resolvedDisplay);
        }

        return resolvedDisplay === null || resolvedDisplay === undefined
          ? ''
          : String(resolvedDisplay);
      });
    });

    cellClassMapRef.current = classMap;
    return dataMatrix;
  }, [filteredData, columns, getCellData]);

  const handleCSVImport = useCallback(async () => {
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
  }, [csvFile, onCSVImport]);

  const renderCell = useCallback<BaseRenderer>(
    (
      instance: CoreInstance,
      td: HTMLTableCellElement,
      rowIndex: number,
      colIndex: number,
      prop: string | number,
      value: unknown,
      cellProperties: CellProperties
    ) => {
      const rendererType =
        typeof cellProperties?.type === 'string' ? cellProperties.type : 'text';
      const baseRenderer = Handsontable.renderers.getRenderer(rendererType);
      baseRenderer(
        instance,
        td,
        rowIndex,
        colIndex,
        prop,
        value,
        cellProperties
      );

      const setStyle = (property: string, styleValue?: string) => {
        if (styleValue) {
          td.style.setProperty(property, styleValue, 'important');
        } else {
          td.style.removeProperty(property);
        }
      };

      td.classList.remove('ht-due-status-today', 'ht-due-status-past');

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
    []
  );

  const handleAfterBeginEditing = useCallback(
    (row: number, col: number) => {
      const column = columns[col];
      if (!column || column.type !== 'dropdown') {
        dropdownEditStateRef.current?.cleanup?.();
        dropdownEditStateRef.current = null;
        return;
      }

      const currentValue = hotRef.current?.hotInstance?.getDataAtCell(row, col);
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
        const editor = getActiveEditor<DropdownSelectionEditor>(
          hotRef.current?.hotInstance
        );

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
    },
    [columns]
  );

  const handleBeforeChange = useCallback<BeforeChangeHandler>(
    (changes: Array<CellChange | null>, _source: ChangeSource) => {
      if (!changes || !dropdownEditStateRef.current) {
        return;
      }

      const state = dropdownEditStateRef.current;
      changes.forEach((change) => {
        if (!change) {
          return;
        }

        const [changeRow, changeCol, oldValue, newValue] = change;
        if (
          changeRow === state.row &&
          changeCol === state.col &&
          columns[changeCol]?.type === 'dropdown'
        ) {
          const normalizedNewValue =
            newValue === null || newValue === undefined
              ? ''
              : String(newValue).trim();
          const dropdownValues = columns[changeCol]?.dropdownValues ?? [];
          const isAllowedDropdownValue =
            normalizedNewValue === '' ||
            dropdownValues.some((value) => value === normalizedNewValue);

          if (state.selectionMade || isAllowedDropdownValue) {
            state.selectionMade = true;
            return;
          }

          change[3] = oldValue;
        }
      });
    },
    [columns]
  );

  const handleAfterChange = useCallback<AfterChangeHandler>(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (!changes || !onCellEdited) {
        dropdownEditStateRef.current?.cleanup?.();
        dropdownEditStateRef.current = null;
        return;
      }

      const changeSource = String(source ?? 'edit');
      if (changeSource === 'revert') {
        dropdownEditStateRef.current?.cleanup?.();
        dropdownEditStateRef.current = null;
        return;
      }

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
          newValue === null || newValue === undefined ? '' : String(newValue);
        const normalizedOldValue =
          oldValue === null || oldValue === undefined ? null : String(oldValue);

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
              .then((accepted) => {
                if (accepted === false) {
                  revertCell(row, col, oldValue);
                  return false;
                }
                return true;
              })
              .catch((error) => {
                logger.error('Cell edit failed during batch operation', error);
                revertCell(row, col, oldValue);
                return false;
              });
          }

          if (result === false) {
            revertCell(row, col, oldValue);
            return Promise.resolve(false);
          }

          return Promise.resolve(true);
        } catch (error) {
          logger.error(
            'Cell edit threw synchronously during batch operation',
            error
          );
          revertCell(row, col, oldValue);
          return Promise.resolve(false);
        }
      };

      if (isBatchOperation) {
        isBatchModeRef.current = true;
        window.dispatchEvent(new CustomEvent('handsontable-batch-start'));

        Promise.all(
          changes.map(([row, col, oldValue, newValue]) =>
            processChange(row, col as number, oldValue, newValue, true)
          )
        )
          .then((results) => {
            window.dispatchEvent(
              new CustomEvent('handsontable-batch-complete', {
                detail: { count: results.filter(Boolean).length },
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
          void processChange(row, col as number, oldValue, newValue, false);
        });
      }

      dropdownEditStateRef.current?.cleanup?.();
      dropdownEditStateRef.current = null;
    },
    [columns, filteredData, onCellEdited, revertCell]
  );

  const handleAfterSelectionEnd = useCallback(
    (row: number, col: number, row2?: number, col2?: number) => {
      handleSelectionSummary(row, col, row2, col2);

      if (!onCellClick) {
        return;
      }

      const targetRow = typeof row2 === 'number' ? row2 : row;
      const targetCol = typeof col2 === 'number' ? col2 : col;
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
    },
    [columns, filteredData, handleSelectionSummary, onCellClick]
  );

  return {
    searchInputRef,
    hotRef,
    currentGridHeight,
    hotColumns,
    hotData,
    handleSearchFocus,
    handleCSVImport,
    handleBeforeStretch,
    handleSelectionSummary,
    handleDeselect,
    renderCell,
    handleAfterBeginEditing,
    handleBeforeChange,
    handleAfterChange,
    handleAfterSelectionEnd,
  } as const;
}
