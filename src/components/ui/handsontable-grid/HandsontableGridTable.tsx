'use client';

import type { MutableRefObject } from 'react';
import { HotTable } from '@handsontable/react';
import type { HotTableClass } from '@handsontable/react';
import type Handsontable from 'handsontable';
import type { HandsontableColumn } from './types';

type BaseRenderer = typeof Handsontable.renderers.BaseRenderer;
type ColumnSettings = Handsontable.ColumnSettings;
type GridSettings = Handsontable.GridSettings;

interface HandsontableGridTableProps {
  hotRef: MutableRefObject<HotTableClass | null>;
  columns: readonly HandsontableColumn[];
  hotData: unknown[][];
  hotColumns: ColumnSettings[];
  currentGridHeight: number;
  stretchColumnId?: string;
  handleBeforeStretch: (stretchedWidth: number, column: number) => number;
  renderCell: BaseRenderer;
  handleAfterBeginEditing: (row: number, col: number) => void;
  handleBeforeChange: NonNullable<GridSettings['beforeChange']>;
  handleAfterChange: NonNullable<GridSettings['afterChange']>;
  handleSelectionSummary: (
    row: number,
    col: number,
    row2?: number,
    col2?: number
  ) => void;
  handleAfterSelectionEnd: (
    row: number,
    col: number,
    row2?: number,
    col2?: number
  ) => void;
  handleDeselect: () => void;
}

export function HandsontableGridTable({
  hotRef,
  columns,
  hotData,
  hotColumns,
  currentGridHeight,
  stretchColumnId,
  handleBeforeStretch,
  renderCell,
  handleAfterBeginEditing,
  handleBeforeChange,
  handleAfterChange,
  handleSelectionSummary,
  handleAfterSelectionEnd,
  handleDeselect,
}: HandsontableGridTableProps) {
  return (
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
        renderAllRows={false}
        renderAllColumns={false}
        viewportRowRenderingOffset={30}
        viewportColumnRenderingOffset={5}
        stretchH={stretchColumnId ? 'all' : 'none'}
        beforeStretchingColumnWidth={handleBeforeStretch}
        autoWrapRow={false}
        autoWrapCol={false}
        manualColumnResize={true}
        manualRowResize={true}
        contextMenu={[]}
        filters={true}
        dropdownMenu={false}
        autoRowSize={false}
        autoColumnSize={false}
        rowHeights={45}
        columnHeaderHeight={45}
        minSpareRows={20}
        cells={() => ({ renderer: renderCell })}
        beforeCut={() => false}
        afterBeginEditing={handleAfterBeginEditing}
        beforeChange={handleBeforeChange}
        afterChange={handleAfterChange}
        afterSelection={(row, col, row2, col2) => {
          handleSelectionSummary(row, col, row2, col2);
        }}
        afterSelectionEnd={(row, col, row2, col2) => {
          handleAfterSelectionEnd(row, col, row2, col2);
        }}
        afterDeselect={handleDeselect}
      />
    </div>
  );
}
