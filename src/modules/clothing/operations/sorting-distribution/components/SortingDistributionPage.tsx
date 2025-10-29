/**
 * Sorting Distribution Page Component
 *
 * Main page component for the Sorting Distribution module.
 * Displays product selection, statistics, quantity pill buttons, and the distribution grid.
 */

'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { Stack, useCombobox } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import '@/styles/handsontable-horizon-light.css';
import { InfoSection, type CustomerNote } from './InfoSection';
import {
  DistributionSummaryBar,
  type ColumnLayout,
} from './DistributionSummaryBar';
import { useSortingDistributionData } from '../hooks/useSortingDistributionData';
import { useSortingDistributionForm } from '../hooks/useSortingDistributionForm';
import type { HotTableClass } from '@handsontable/react';

// Register Handsontable modules
registerAllModules();

/**
 * Sorting Distribution Page Component
 */
export function SortingDistributionPage() {
  const hotTableRef = useRef<HotTableClass | null>(null);
  const isEffectivelyEmpty = useCallback((value: unknown) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim() === '';
    }
    if (typeof value === 'number') {
      return value === 0;
    }
    if (typeof value === 'boolean') {
      return !value;
    }
    return false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight'
      ) {
        return;
      }

      const hot = hotTableRef.current?.hotInstance ?? null;
      if (!hot) {
        return;
      }

      const lastSelection = hot.getSelectedLast();
      if (!lastSelection) {
        return;
      }

      const [startRow, startCol, endRow, endCol] = lastSelection;
      const currentRow = endRow ?? startRow;
      const currentCol = endCol ?? startCol;

      if (
        currentRow === null ||
        currentRow === undefined ||
        currentCol === null ||
        currentCol === undefined
      ) {
        return;
      }

      const columnsSetting = hot.getSettings().columns;
      const getColumnDataId = (colIndex: number) => {
        if (!Array.isArray(columnsSetting)) {
          return undefined;
        }
        const config = columnsSetting[colIndex] as
          | { data?: string }
          | undefined;
        return typeof config?.data === 'string' ? config.data : undefined;
      };
      const isCheckboxColumn = (colIndex: number) =>
        getColumnDataId(colIndex) === 'checked';

      if (isCheckboxColumn(currentCol)) {
        return;
      }

      const isCellEmpty = (row: number, col: number) => {
        if (row < 0 || col < 0) {
          return true;
        }
        if (isCheckboxColumn(col)) {
          return false;
        }
        const value = hot.getDataAtCell(row, col);
        return isEffectivelyEmpty(value);
      };

      let targetRow = currentRow;
      let targetCol = currentCol;

      if (event.key === 'ArrowDown') {
        const maxRow = hot.countRows() - 1;
        const currentEmpty = isCellEmpty(currentRow, currentCol);
        if (currentEmpty) {
          for (let row = currentRow + 1; row <= maxRow; row += 1) {
            if (!isCellEmpty(row, currentCol)) {
              targetRow = row;
              break;
            }
          }
          if (targetRow === currentRow) {
            targetRow = maxRow;
          }
        } else {
          let lastNonEmpty = currentRow;
          for (let row = currentRow + 1; row <= maxRow; row += 1) {
            if (!isCellEmpty(row, currentCol)) {
              lastNonEmpty = row;
            } else {
              break;
            }
          }
          if (lastNonEmpty > currentRow) {
            targetRow = lastNonEmpty;
          } else {
            for (let row = currentRow + 1; row <= maxRow; row += 1) {
              if (!isCellEmpty(row, currentCol)) {
                targetRow = row;
                break;
              }
            }
            if (targetRow === currentRow) {
              targetRow = maxRow;
            }
          }
        }
      } else if (event.key === 'ArrowUp') {
        const currentEmpty = isCellEmpty(currentRow, currentCol);
        if (currentEmpty) {
          for (let row = currentRow - 1; row >= 0; row -= 1) {
            if (!isCellEmpty(row, currentCol)) {
              targetRow = row;
              break;
            }
          }
          if (targetRow === currentRow) {
            targetRow = 0;
          }
        } else {
          let firstNonEmpty = currentRow;
          for (let row = currentRow - 1; row >= 0; row -= 1) {
            if (!isCellEmpty(row, currentCol)) {
              firstNonEmpty = row;
            } else {
              break;
            }
          }
          if (firstNonEmpty < currentRow) {
            targetRow = firstNonEmpty;
          } else {
            for (let row = currentRow - 1; row >= 0; row -= 1) {
              if (!isCellEmpty(row, currentCol)) {
                targetRow = row;
                break;
              }
            }
            if (targetRow === currentRow) {
              targetRow = 0;
            }
          }
        }
      } else if (event.key === 'ArrowRight') {
        const maxCol = hot.countCols() - 1;
        const currentEmpty = isCellEmpty(currentRow, currentCol);
        if (currentEmpty) {
          for (let col = currentCol + 1; col <= maxCol; col += 1) {
            if (isCheckboxColumn(col)) {
              continue;
            }
            if (!isCellEmpty(currentRow, col)) {
              targetCol = col;
              break;
            }
          }
          if (targetCol === currentCol) {
            let fallbackCol = maxCol;
            while (fallbackCol > currentCol && isCheckboxColumn(fallbackCol)) {
              fallbackCol -= 1;
            }
            targetCol = fallbackCol >= 0 ? fallbackCol : currentCol;
          }
        } else {
          let lastNonEmpty = currentCol;
          for (let col = currentCol + 1; col <= maxCol; col += 1) {
            if (isCheckboxColumn(col)) {
              continue;
            }
            if (!isCellEmpty(currentRow, col)) {
              lastNonEmpty = col;
            } else {
              break;
            }
          }
          if (lastNonEmpty > currentCol) {
            targetCol = lastNonEmpty;
          } else {
            for (let col = currentCol + 1; col <= maxCol; col += 1) {
              if (isCheckboxColumn(col)) {
                continue;
              }
              if (!isCellEmpty(currentRow, col)) {
                targetCol = col;
                break;
              }
            }
            if (targetCol === currentCol) {
              let fallbackCol = maxCol;
              while (
                fallbackCol > currentCol &&
                isCheckboxColumn(fallbackCol)
              ) {
                fallbackCol -= 1;
              }
              targetCol = fallbackCol >= 0 ? fallbackCol : currentCol;
            }
          }
        }
      } else if (event.key === 'ArrowLeft') {
        const currentEmpty = isCellEmpty(currentRow, currentCol);
        if (currentEmpty) {
          for (let col = currentCol - 1; col >= 0; col -= 1) {
            if (isCheckboxColumn(col)) {
              continue;
            }
            if (!isCellEmpty(currentRow, col)) {
              targetCol = col;
              break;
            }
          }
          if (targetCol === currentCol) {
            let fallbackCol = 0;
            while (fallbackCol < currentCol && isCheckboxColumn(fallbackCol)) {
              fallbackCol += 1;
            }
            targetCol =
              fallbackCol <= hot.countCols() - 1 ? fallbackCol : currentCol;
          }
        } else {
          let firstNonEmpty = currentCol;
          for (let col = currentCol - 1; col >= 0; col -= 1) {
            if (isCheckboxColumn(col)) {
              continue;
            }
            if (!isCellEmpty(currentRow, col)) {
              firstNonEmpty = col;
            } else {
              break;
            }
          }
          if (firstNonEmpty < currentCol) {
            targetCol = firstNonEmpty;
          } else {
            for (let col = currentCol - 1; col >= 0; col -= 1) {
              if (isCheckboxColumn(col)) {
                continue;
              }
              if (!isCellEmpty(currentRow, col)) {
                targetCol = col;
                break;
              }
            }
            if (targetCol === currentCol) {
              let fallbackCol = 0;
              while (
                fallbackCol < currentCol &&
                isCheckboxColumn(fallbackCol)
              ) {
                fallbackCol += 1;
              }
              targetCol =
                fallbackCol <= hot.countCols() - 1 ? fallbackCol : currentCol;
            }
          }
        }
      }

      if (targetRow === currentRow && targetCol === currentCol) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      hot.selectCell(targetRow, targetCol);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isEffectivelyEmpty]);

  // Form state
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null);

  // State for product selection - restore from localStorage on mount
  const [productCode, setProductCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sorting-distribution-product-code') || '';
    }
    return '';
  });

  // Initialize data hook
  const dataHook = useSortingDistributionData({
    productCode,
    selectedQuantity,
    onSelectedQuantityChange: setSelectedQuantity,
  });

  const { totalDistribution, availableStock } = dataHook.statistics;

  const productSelectCombobox = useCombobox();

  const focusSearchInputSafely = useCallback(() => {
    let attempts = 0;
    const tryFocus = () => {
      const searchInput = productSelectCombobox.searchRef.current;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
        return;
      }

      if (attempts >= 3) {
        productSelectCombobox.focusTarget();
        return;
      }

      attempts += 1;
      requestAnimationFrame(tryFocus);
    };

    tryFocus();
  }, [productSelectCombobox]);

  const focusProductSelect = useCallback(() => {
    productSelectCombobox.openDropdown('keyboard');
    requestAnimationFrame(() => {
      productSelectCombobox.updateSelectedOptionIndex('selected', {
        scrollIntoView: true,
      });
      focusSearchInputSafely();
    });
  }, [productSelectCombobox, focusSearchInputSafely]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (event.key.toLowerCase() !== 'f') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusProductSelect();
    };

    document.addEventListener('keydown', handleShortcut, true);
    return () => {
      document.removeEventListener('keydown', handleShortcut, true);
    };
  }, [focusProductSelect]);

  const [columnLayout, setColumnLayout] = useState<ColumnLayout | null>(null);

  const updateColumnLayout = useCallback(() => {
    const hot = hotTableRef.current?.hotInstance;
    const rootElement = hot?.rootElement ?? null;
    if (!rootElement) {
      return;
    }

    const headerRow = rootElement.querySelector(
      '.ht_clone_top .wtHolder thead tr'
    );
    if (!headerRow) {
      return;
    }

    const cells = Array.from(headerRow.children) as HTMLElement[];
    if (cells.length <= 1) {
      return;
    }

    const widths = cells.map((cell) =>
      Math.round(cell.getBoundingClientRect().width)
    );
    const [rowHeaderWidth, ...rawColWidths] = widths;
    if (!Number.isFinite(rowHeaderWidth)) {
      return;
    }
    const expectedCols = hot?.countCols() ?? rawColWidths.length;
    const colWidths = [...rawColWidths];
    while (colWidths.length < expectedCols) {
      colWidths.push(colWidths[colWidths.length - 1] ?? rowHeaderWidth ?? 120);
    }

    setColumnLayout((prev) => {
      if (prev) {
        const sameRowHeader = prev.rowHeaderWidth === rowHeaderWidth;
        const sameColumns =
          prev.colWidths.length === colWidths.length &&
          prev.colWidths.every((width, index) => width === colWidths[index]);
        if (sameRowHeader && sameColumns) {
          return prev;
        }
      }
      return { rowHeaderWidth, colWidths };
    });
  }, []);

  useLayoutEffect(() => {
    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        updateColumnLayout();
      });
    };

    const hot = hotTableRef.current?.hotInstance;
    const hookableHot = hot as unknown as {
      addHook?: (key: string, callback: () => void) => void;
      removeHook?: (key: string, callback: () => void) => void;
      isDestroyed?: () => boolean;
    };
    const rootElement = hot?.rootElement ?? null;
    const holder = rootElement?.querySelector(
      '.ht_master .wtHolder'
    ) as HTMLElement | null;

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    hookableHot?.addHook?.('afterRender', scheduleUpdate);

    let resizeObserver: ResizeObserver | null = null;
    if (holder) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(holder);
    }

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', scheduleUpdate);
      if (
        hookableHot?.isDestroyed &&
        typeof hookableHot.isDestroyed === 'function' &&
        !hookableHot.isDestroyed()
      ) {
        hookableHot.removeHook?.('afterRender', scheduleUpdate);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [
    updateColumnLayout,
    dataHook.rows.length,
    selectedQuantity,
    totalDistribution,
    availableStock,
  ]);

  // Initialize form hook with loaded products
  const form = useSortingDistributionForm({
    allProducts: dataHook.allProducts,
  });

  const customerNotes = useMemo<CustomerNote[]>(() => {
    if (!form.item) {
      return [];
    }

    const noteFieldOrder = [
      'Notes',
      'Note',
      'Requests',
      'Request',
      'Remarks',
    ] as const;
    const optionalIdentityFields = [
      'Order Code',
      'Order Date',
      'Line Total',
      'Packed Date',
      'Shipment Code',
    ];

    const seenIds = new Set<string>();

    return dataHook.transactions
      .filter((transaction) => transaction['Product Code'] === form.item)
      .map((transaction) => {
        const note = noteFieldOrder
          .map((field) => transaction[field])
          .find(
            (value) => typeof value === 'string' && value.trim().length > 0
          );

        if (!note) {
          return null;
        }

        const normalizedNote = note.trim();

        const baseIdParts = [
          transaction['Product Code'],
          transaction.Customers,
          `${transaction.Quantity ?? ''}`,
          normalizedNote,
        ];

        const transactionRecord = transaction as unknown as Record<
          string,
          unknown
        >;
        optionalIdentityFields.forEach((field) => {
          const value = transactionRecord[field];
          if (typeof value === 'string' && value.trim().length > 0) {
            baseIdParts.push(value.trim());
          }
        });

        const candidateId = baseIdParts.filter(Boolean).join('|');

        if (seenIds.has(candidateId)) {
          return null;
        }
        seenIds.add(candidateId);

        const customerNote: CustomerNote = {
          id: candidateId,
          customer: transaction.Customers,
          note: normalizedNote,
        };
        return customerNote;
      })
      .filter((entry): entry is CustomerNote => entry !== null);
  }, [dataHook.transactions, form.item]);

  // Sync product code between form and data hook
  const handleItemChange = useCallback(
    (item: string) => {
      form.setItem(item);
      setProductCode(item);
      // Save to localStorage for persistence across refreshes
      if (typeof window !== 'undefined') {
        if (item) {
          localStorage.setItem('sorting-distribution-product-code', item);
        } else {
          localStorage.removeItem('sorting-distribution-product-code');
        }
      }
    },
    [form]
  );

  // Restore form item when products are loaded and we have a saved product code
  useEffect(() => {
    if (productCode && dataHook.allProducts.length > 0 && !form.item) {
      // Check if the saved product code exists in the product list
      const productExists = dataHook.productOptions.includes(productCode);
      if (productExists) {
        form.setItem(productCode);
      }
    }
  }, [productCode, dataHook.allProducts, dataHook.productOptions, form]);

  // Add vertical middle alignment styles
  useEffect(() => {
    const styleId = 'sorting-distribution-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .ht-theme-horizon .handsontable td,
      .ht-theme-horizon .handsontable th {
        vertical-align: middle !important;
      }
      
      .ht-theme-horizon .handsontable thead th {
        vertical-align: middle !important;
        padding-top: 8px !important;
        padding-bottom: 8px !important;
      }
      
      .ht-theme-horizon .handsontable thead th .relative {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Transform data for Handsontable (object format for checkbox support)
  const tableData = dataHook.rows.map((row) => ({
    quantity: row.quantity,
    percentage: row.percentage === 0 ? '' : `${row.percentage.toFixed(2)}%`,
    groupNumber: row.groupNumber,
    distribution: row.distribution,
    checked: row.checked,
  }));

  // Custom renderer for greyed-out cells
  const greyedOutRenderer = useCallback(
    (
      instance: unknown,
      td: HTMLTableCellElement,
      row: number,
      col: number,
      prop: string | number,
      value: unknown,
      cellProperties: unknown
    ) => {
      // Call default text renderer first so Handsontable maintains editors and formatting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textRenderer = (window as any).Handsontable?.renderers
        ?.TextRenderer;
      if (textRenderer) {
        textRenderer(instance, td, row, col, prop, value, cellProperties);
      } else {
        td.textContent =
          value !== null && value !== undefined ? String(value) : '';
      }

      // Apply center alignment
      td.style.textAlign = 'center';
      td.style.verticalAlign = 'middle';

      // Hide zeroes to keep the grid visually clean while preserving the underlying values
      const shouldHideZero =
        prop !== 'checked' &&
        prop !== 'percentage' &&
        value !== '' &&
        value !== null &&
        value !== undefined &&
        Number(value) === 0;
      if (shouldHideZero) {
        td.textContent = '';
      }

      const rowData = dataHook.rows[row];
      if (rowData?.checked) {
        td.style.backgroundColor = '#f0f0f0';
        td.style.color = '#999';
      }
    },
    [dataHook.rows]
  );

  // Handle cell changes
  const handleAfterChange = useCallback(
    (changes: unknown[] | null, source: string) => {
      if (!changes || source === 'loadData') {
        return;
      }

      changes.forEach((change) => {
        const [row, prop, oldValue, newValue] = change as [
          number,
          string,
          unknown,
          unknown,
        ];
        if (oldValue === newValue) {
          return;
        }

        if (prop === 'quantity') {
          // Quantity column - handle both number and string (empty string becomes 0)
          const numValue =
            newValue === '' || newValue === null || newValue === undefined
              ? 0
              : Number(newValue);
          dataHook.updateRowQuantity(row, isNaN(numValue) ? 0 : numValue);
        } else if (prop === 'checked') {
          // Checkbox column
          dataHook.updateRowCheckbox(row, Boolean(newValue));
        }
        // Note: distribution column is calculated, not editable
      });
    },
    [dataHook]
  );

  return (
    <PageLayout fluid withPadding>
      <Stack gap="md">
        {/* Information Section */}
        <InfoSection
          item={form.item}
          ordered={form.ordered}
          productOptions={dataHook.productOptions}
          statistics={dataHook.statistics}
          uniqueQuantities={dataHook.uniqueQuantities}
          selectedQuantity={selectedQuantity}
          onSelectQuantity={setSelectedQuantity}
          productSelectCombobox={productSelectCombobox}
          onItemChange={handleItemChange}
          customerNotes={customerNotes}
        />

        {/* Distribution Grid with Handsontable */}
        <div style={{ width: '100%', overflow: 'auto' }}>
          <HotTable
            ref={hotTableRef}
            themeName="ht-theme-horizon"
            data={tableData}
            colHeaders={[
              'Quantity',
              'Percentage',
              'Group Number',
              'Distribution',
              'Checkbox',
            ]}
            headerClassName="htCenter htMiddle"
            columns={[
              {
                data: 'quantity',
                type: 'numeric',
                renderer: greyedOutRenderer,
                className: 'htCenter',
              },
              {
                data: 'percentage',
                type: 'text',
                renderer: greyedOutRenderer,
                readOnly: true,
                className: 'htCenter',
              },
              {
                data: 'groupNumber',
                type: 'text',
                renderer: greyedOutRenderer,
                readOnly: true,
                className: 'htCenter',
              },
              {
                data: 'distribution',
                type: 'numeric',
                renderer: greyedOutRenderer,
                readOnly: true,
                className: 'htCenter',
              },
              {
                data: 'checked',
                type: 'checkbox',
                className: 'htCenter',
              },
            ]}
            rowHeaders={true}
            width="100%"
            height="calc(90vh - 280px)"
            stretchH="all"
            licenseKey="non-commercial-and-evaluation"
            afterChange={handleAfterChange}
            allowInsertColumn={false}
            allowInsertRow={false}
            allowRemoveColumn={false}
            allowRemoveRow={false}
            contextMenu={false}
            beforeCut={() => false}
          />
        </div>

        <DistributionSummaryBar
          rows={dataHook.rows}
          statistics={dataHook.statistics}
          selectedQuantity={selectedQuantity}
          isSaving={dataHook.isSaving}
          columnLayout={columnLayout}
        />
      </Stack>
    </PageLayout>
  );
}
