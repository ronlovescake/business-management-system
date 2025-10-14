/**
 * Sorting Distribution Page Component
 *
 * Main page component for the Sorting Distribution module.
 * Displays product selection, statistics, quantity pill buttons, and the distribution grid.
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { GridView } from '@/components/grid/GridView';
import { GridCellKind } from '@glideapps/glide-data-grid';
import type {
  GridColumn,
  Item,
  GridCell,
  EditableGridCell,
  GridSelection,
} from '@glideapps/glide-data-grid';
import { InfoSection } from './InfoSection';
import { QuantityPillButtons } from './QuantityPillButtons';
import { useSortingDistributionData } from '../hooks/useSortingDistributionData';
import { useSortingDistributionForm } from '../hooks/useSortingDistributionForm';
import {
  GRID_COLUMNS,
  CUSTOM_GRID_STYLES,
} from '../types/sortingDistribution.types';
import { logger } from '@/lib/logger';

/**
 * Sorting Distribution Page Component
 */
export function SortingDistributionPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [gridSelection, setGridSelection] = useState<
    GridSelection | undefined
  >();

  // Form state
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null);

  // Initialize hooks (must pass selectedQuantity state)
  const formHook = useSortingDistributionForm({
    allProducts: [], // Will be populated by data hook
  });

  const dataHook = useSortingDistributionData({
    productCode: formHook.item,
    selectedQuantity,
    onSelectedQuantityChange: setSelectedQuantity,
  });

  // Update form hook with loaded products
  const form = useSortingDistributionForm({
    allProducts: dataHook.allProducts,
  });

  /**
   * Inject custom styles on client side
   */
  useEffect(() => {
    setIsMounted(true);

    const styleId = 'sorting-distribution-custom-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = CUSTOM_GRID_STYLES;
      document.head.appendChild(styleElement);
    }

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  /**
   * Handle spacebar key to toggle all checkboxes
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && event.target instanceof HTMLElement) {
        const isInGrid = event.target.closest('.data-grid-container');
        if (isInGrid) {
          event.preventDefault();
          dataHook.toggleAllCheckboxes();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dataHook]);

  /**
   * Memoize columns array
   */
  const columns: GridColumn[] = useMemo(
    () =>
      GRID_COLUMNS.map((col) => ({
        title: col.title,
        width: col.width,
        id: col.id,
        grow: col.grow,
      })),
    []
  );

  /**
   * Get cell content
   */
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData = dataHook.rows[row];

      if (!rowData) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      const column = columns[col];
      const isGreyedOut = rowData.checked;
      const greyTheme = isGreyedOut
        ? {
            bgCell: '#e9ecef',
            fgCell: '#868e96',
          }
        : undefined;

      switch (column.id) {
        case 'quantity':
          return {
            kind: GridCellKind.Number,
            data: rowData.quantity,
            displayData:
              rowData.quantity === 0 ? '' : rowData.quantity.toString(),
            allowOverlay: true,
            readonly: false,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'percentage':
          return {
            kind: GridCellKind.Number,
            data: rowData.percentage,
            displayData:
              rowData.percentage === 0
                ? ''
                : rowData.percentage.toFixed(2) + '%',
            allowOverlay: false,
            readonly: true,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'groupNumber':
          return {
            kind: GridCellKind.Text,
            data: rowData.groupNumber,
            displayData: rowData.groupNumber,
            allowOverlay: false,
            readonly: true,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'distribution':
          return {
            kind: GridCellKind.Number,
            data: rowData.distribution,
            displayData:
              rowData.distribution === 0 ? '' : rowData.distribution.toString(),
            allowOverlay: false,
            readonly: true,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'checkbox':
          return {
            kind: GridCellKind.Boolean,
            data: rowData.checked,
            allowOverlay: false,
            readonly: false,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        default:
          return {
            kind: GridCellKind.Text,
            data: '',
            displayData: '',
            allowOverlay: false,
          };
      }
    },
    [dataHook.rows, columns]
  );

  /**
   * Handle cell edits
   */
  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = columns[col];

      switch (column.id) {
        case 'quantity':
          if (newValue.kind === GridCellKind.Number) {
            dataHook.updateRowQuantity(row, newValue.data ?? 0);
          }
          break;

        case 'checkbox':
          if (newValue.kind === GridCellKind.Boolean) {
            dataHook.updateRowCheckbox(row, newValue.data ?? false);
          }
          break;

        default:
          break;
      }
    },
    [columns, dataHook]
  );

  /**
   * Get row count
   */
  const getRowCount = useCallback(() => dataHook.rows.length, [dataHook.rows]);

  /**
   * Custom header drawing for center alignment
   */
  const drawHeader = useCallback(
    (args: {
      ctx: CanvasRenderingContext2D;
      rect: { x: number; y: number; width: number; height: number };
      column: GridColumn;
    }) => {
      const { ctx, rect, column } = args;

      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      ctx.fillStyle = '#000000';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      ctx.fillText(column.title, centerX, centerY);

      return true;
    },
    []
  );

  /**
   * Handle header menu clicks (right-click on header)
   */
  const handleHeaderMenuClick = useCallback(
    (col: number) => {
      const column = columns[col];

      if (column.id === 'quantity') {
        const confirmClear = window.confirm(
          `Are you sure you want to clear all values in the "${column.title}" column?`
        );

        if (confirmClear) {
          dataHook.clearAllQuantities();
          logger.debug(`Cleared all values in ${column.title} column`);
        }
      } else {
        alert(
          `The "${column.title}" column cannot be manually cleared as it contains calculated values.`
        );
      }

      return undefined;
    },
    [columns, dataHook]
  );

  /**
   * Handle paste event
   */
  const handlePasteEvent = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      const [col, row] = target;

      // Only allow pasting to Quantity column (index 0)
      if (col !== 0) {
        return false;
      }

      dataHook.handlePaste(row, values);
      return true;
    },
    [dataHook]
  );

  if (!isMounted) {
    return null;
  }

  return (
    <PageLayout fluid withPadding>
      <Stack gap="md">
        {/* Information Section */}
        <InfoSection
          item={form.item}
          ordered={form.ordered}
          productOptions={dataHook.productOptions}
          statistics={dataHook.statistics}
          onItemChange={form.setItem}
        />

        {/* Quantity Pill Buttons */}
        <QuantityPillButtons
          uniqueQuantities={dataHook.uniqueQuantities}
          selectedQuantity={selectedQuantity}
          onSelectQuantity={setSelectedQuantity}
        />

        {/* Distribution Grid */}
        <GridView
          columns={columns}
          rows={getRowCount()}
          getCellContent={getData}
          onCellEdited={onCellEdited}
          gridSelection={gridSelection}
          onGridSelectionChange={setGridSelection}
          onHeaderMenuClick={handleHeaderMenuClick}
          onPaste={handlePasteEvent}
          drawHeader={drawHeader}
          smoothScrollX
          smoothScrollY
        />
      </Stack>
    </PageLayout>
  );
}
