'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  GridCellKind,
  GridColumn,
  Item,
  type GridCell,
  type EditableGridCell,
} from '@glideapps/glide-data-grid';
import { Stack, Loader } from '@mantine/core';

// Import Glide Data Grid CSS
import '@glideapps/glide-data-grid/dist/index.css';

// Custom styles for larger font and center aligned headers
const customGridStyles = `
  .data-grid-container * {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container canvas {
    font-size: 20px !important;
  }
  .data-grid-container .gdg-cell {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container .gdg-header {
    font-size: 20px !important;
    font-weight: 600 !important;
    font-family: Inter, sans-serif !important;
    text-align: center !important;
  }
  .data-grid-container .gdg-cell-text {
    font-size: 20px !important;
  }
  .data-grid-container [role="gridcell"] {
    font-size: 20px !important;
  }
  .data-grid-container [role="columnheader"] {
    font-size: 20px !important;
    font-weight: 600 !important;
    text-align: center !important;
    justify-content: center !important;
    display: flex !important;
    align-items: center !important;
  }
  .data-grid-container div {
    font-size: 20px !important;
  }
  .dvn-scroller {
    font-size: 20px !important;
  }
`;

// Dynamic import to prevent SSR issues
const DataEditor = dynamic(
  () => import('@glideapps/glide-data-grid').then((mod) => mod.DataEditor),
  {
    ssr: false,
    loading: () => <Loader />,
  }
);

interface DistributionRow {
  quantity: number;
  percentage: number;
  groupNumber: string; // Changed to string to hold "Number X" format
  distribution: number;
  checked: boolean;
}

export default function SortingDistribution() {
  const [gridHeight, setGridHeight] = useState<number>(600);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize 100 rows with default values
  const [rows, setRows] = useState<DistributionRow[]>(() => {
    return Array.from({ length: 100 }, () => ({
      quantity: 0,
      percentage: 0,
      groupNumber: '',
      distribution: 0,
      checked: false,
    }));
  });

  // Inject styles only on client side to prevent hydration errors
  React.useEffect(() => {
    setIsMounted(true);

    // Inject custom styles
    const styleId = 'sorting-distribution-custom-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = customGridStyles;
      document.head.appendChild(styleElement);
    }

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  // Keep grid height at ~85vh responsively
  React.useEffect(() => {
    const updateHeight = () => {
      const h = Math.floor(window.innerHeight * 0.85);
      setGridHeight(Math.max(300, h));
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // 🚀 Auto-populate Group Number based on non-empty Quantity rows
  const quantitiesString = useMemo(
    () => rows.map((r) => r.quantity).join(','),
    [rows]
  );

  React.useEffect(() => {
    setRows((prevRows) => {
      const newRows = [...prevRows];
      let counter = 1;

      // Calculate total sum of all quantities
      const totalQuantity = newRows.reduce(
        (sum, row) => sum + (row.quantity > 0 ? row.quantity : 0),
        0
      );

      // Iterate through all rows and assign group numbers to rows with quantity > 0
      for (let i = 0; i < newRows.length; i++) {
        if (newRows[i].quantity > 0) {
          // Calculate percentage: (quantity / total) * 100
          const percentage =
            totalQuantity > 0 ? (newRows[i].quantity / totalQuantity) * 100 : 0;

          newRows[i] = {
            ...newRows[i],
            groupNumber: `Number ${counter}`,
            percentage: percentage,
          };
          counter++;
        } else {
          // Clear group number and percentage if quantity is 0 or empty
          newRows[i] = {
            ...newRows[i],
            groupNumber: '',
            percentage: 0,
          };
        }
      }

      return newRows;
    });
  }, [quantitiesString]); // Re-run when any quantity changes

  // 🚀 PERFORMANCE: Memoize columns array to prevent recreation on every render
  const columns: GridColumn[] = useMemo(
    () => [
      { title: 'Quantity', width: 200, id: 'quantity' },
      { title: 'Percentage', width: 200, id: 'percentage' },
      { title: 'Group Number', width: 200, id: 'groupNumber' },
      { title: 'Distribution', width: 200, id: 'distribution' },
      { title: 'Checkbox', width: 150, id: 'checkbox', grow: 1 },
    ],
    []
  );

  // Get cell content
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData = rows[row];

      if (!rowData) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      const column = columns[col];

      // Determine if row should be greyed out (checkbox is checked)
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
            displayData: rowData.quantity.toString(),
            allowOverlay: true,
            readonly: false,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'percentage':
          return {
            kind: GridCellKind.Number,
            data: rowData.percentage,
            displayData: rowData.percentage.toFixed(2) + '%',
            allowOverlay: false,
            readonly: true, // Will add formula later
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'groupNumber':
          return {
            kind: GridCellKind.Text,
            data: rowData.groupNumber,
            displayData: rowData.groupNumber,
            allowOverlay: false,
            readonly: true, // Auto-populated based on Quantity
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'distribution':
          return {
            kind: GridCellKind.Number,
            data: rowData.distribution,
            displayData: rowData.distribution.toString(),
            allowOverlay: false,
            readonly: true, // Will add formula later
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
    [rows, columns]
  );

  // Handle cell edits
  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = columns[col];

      setRows((prevRows) => {
        const newRows = [...prevRows];
        const rowData = { ...newRows[row] };

        switch (column.id) {
          case 'quantity':
            if (newValue.kind === GridCellKind.Number) {
              rowData.quantity = newValue.data ?? 0;
            }
            break;

          case 'checkbox':
            if (newValue.kind === GridCellKind.Boolean) {
              rowData.checked = newValue.data ?? false;
            }
            break;

          default:
            break;
        }

        newRows[row] = rowData;
        return newRows;
      });
    },
    [columns]
  );

  // Get row count
  const getRowCount = useCallback(() => rows.length, [rows]);

  // Handle spacebar to toggle all checkboxes
  // This will work when the user presses spacebar anywhere in the grid
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && event.target instanceof HTMLElement) {
        // Check if the target is within the data-grid-container
        const isInGrid = event.target.closest('.data-grid-container');
        if (isInGrid) {
          event.preventDefault();

          // Determine if we should check or uncheck all
          // If any checkbox is unchecked, check all. If all are checked, uncheck all.
          setRows((prevRows) => {
            const hasUnchecked = prevRows.some((row) => !row.checked);
            const newCheckedState = hasUnchecked;

            return prevRows.map((row) => ({
              ...row,
              checked: newCheckedState,
            }));
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Custom header drawing for center alignment
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

  return (
    <PageLayout title="Sorting & Distribution">
      <Stack gap="md">
        {isMounted && (
          <div
            className="data-grid-container"
            style={{ height: `${gridHeight}px` }}
            tabIndex={0}
          >
            <DataEditor
              columns={columns}
              rows={getRowCount()}
              getCellContent={getData}
              onCellEdited={onCellEdited}
              drawHeader={drawHeader}
              smoothScrollX={true}
              smoothScrollY={true}
              rowHeight={35}
              headerHeight={40}
              rowMarkers="number"
              theme={{
                accentColor: '#228be6',
                accentLight: '#e7f5ff',
                textDark: '#000000',
                textMedium: '#495057',
                textLight: '#868e96',
                textBubble: '#000000',
                bgIconHeader: '#f8f9fa',
                fgIconHeader: '#495057',
                bgCell: '#ffffff',
                bgCellMedium: '#f8f9fa',
                bgHeader: '#f8f9fa',
                bgHeaderHasFocus: '#e9ecef',
                bgHeaderHovered: '#e9ecef',
                borderColor: '#dee2e6',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>
        )}
      </Stack>
    </PageLayout>
  );
}
