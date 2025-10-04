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
  groupNumber: number;
  distribution: number;
  checked: boolean;
}

export default function SortingDistribution() {
  const [gridHeight, setGridHeight] = useState<number>(600);

  // Initialize 100 rows with default values
  const [rows, setRows] = useState<DistributionRow[]>(() => {
    return Array.from({ length: 100 }, () => ({
      quantity: 0,
      percentage: 0,
      groupNumber: 0,
      distribution: 0,
      checked: false,
    }));
  });

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

      switch (column.id) {
        case 'quantity':
          return {
            kind: GridCellKind.Number,
            data: rowData.quantity,
            displayData: rowData.quantity.toString(),
            allowOverlay: true,
            readonly: false,
          };

        case 'percentage':
          return {
            kind: GridCellKind.Number,
            data: rowData.percentage,
            displayData: rowData.percentage.toFixed(2) + '%',
            allowOverlay: false,
            readonly: true, // Will add formula later
          };

        case 'groupNumber':
          return {
            kind: GridCellKind.Number,
            data: rowData.groupNumber,
            displayData: rowData.groupNumber.toString(),
            allowOverlay: false,
            readonly: true, // Will add formula later
          };

        case 'distribution':
          return {
            kind: GridCellKind.Number,
            data: rowData.distribution,
            displayData: rowData.distribution.toString(),
            allowOverlay: false,
            readonly: true, // Will add formula later
          };

        case 'checkbox':
          return {
            kind: GridCellKind.Boolean,
            data: rowData.checked,
            allowOverlay: false,
            readonly: false,
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
      <style>{customGridStyles}</style>

      <Stack gap="md">
        <div
          className="data-grid-container"
          style={{ height: `${gridHeight}px` }}
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
      </Stack>
    </PageLayout>
  );
}
