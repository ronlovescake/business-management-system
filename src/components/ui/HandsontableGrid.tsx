'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import {
  registerAllCellTypes,
  registerAllEditors,
  registerAllRenderers,
  registerAllValidators,
} from 'handsontable/registry';
import {
  AutoColumnSize,
  Autofill,
  AutoRowSize,
  BindRowsWithHeaders,
  CollapsibleColumns,
  ColumnSorting,
  ColumnSummary,
  Comments,
  ContextMenu,
  CopyPaste,
  CustomBorders,
  DragToScroll,
  DropdownMenu,
  ExportFile,
  Filters,
  HiddenColumns,
  HiddenRows,
  ManualColumnFreeze,
  ManualColumnMove,
  ManualColumnResize,
  ManualRowMove,
  ManualRowResize,
  MergeCells,
  MultiColumnSorting,
  MultipleSelectionHandles,
  NestedHeaders,
  NestedRows,
  PersistentState,
  Search,
  TouchScroll,
  TrimRows,
  UndoRedo,
  registerPlugin,
} from 'handsontable/plugins';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import '@/styles/handsontable-horizon-light.css';
import { StatsCardGrid } from './StatsCardGrid';
import { HandsontableGridToolbar } from './handsontable-grid/HandsontableGridToolbar';
import { HandsontableGridFooter } from './handsontable-grid/HandsontableGridFooter';
import { HandsontableGridTable } from './handsontable-grid/HandsontableGridTable';
import { useHandsontableGridController } from './handsontable-grid/useHandsontableGridController';
import type { HandsontableGridProps } from './handsontable-grid/types';

export type {
  TableColumnAlignment,
  HandsontableColumnType,
  HandsontableColumn,
  CellData,
  CellEditEvent,
  GetCellData,
  CellClickEvent,
  SelectionSummary,
  HandsontableGridProps,
} from './handsontable-grid/types';

registerAllCellTypes();
registerAllRenderers();
registerAllValidators();
registerAllEditors();

// CSP / strict mode: register every Handsontable plugin EXCEPT `Formulas`.
// The Formulas plugin compiles spreadsheet expressions via `new Function()`,
// which violates a `script-src 'self'` CSP. This codebase does not use
// spreadsheet formulas in any grid, so dropping the plugin removes the only
// `eval` usage from Handsontable without any functional impact. See
// IMPROVEMENTS_CHECKLIST.md §4.2 (STRICT_CSP) for context.
[
  AutoColumnSize,
  Autofill,
  AutoRowSize,
  BindRowsWithHeaders,
  CollapsibleColumns,
  ColumnSorting,
  ColumnSummary,
  Comments,
  ContextMenu,
  CopyPaste,
  CustomBorders,
  DragToScroll,
  DropdownMenu,
  ExportFile,
  Filters,
  HiddenColumns,
  HiddenRows,
  ManualColumnFreeze,
  ManualColumnMove,
  ManualColumnResize,
  ManualRowMove,
  ManualRowResize,
  MergeCells,
  MultiColumnSorting,
  MultipleSelectionHandles,
  NestedHeaders,
  NestedRows,
  PersistentState,
  Search,
  TouchScroll,
  TrimRows,
  UndoRedo,
].forEach((plugin) => {
  registerPlugin(plugin);
});

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
  secondarySearchControl,
  searchRightButtons,
  searchBottomContent,
  stackActionsBelowSearch = false,
  onCellClick,
  getCellData,
  onCellEdited,
  onSelectionSummaryChange,
  showFooter = true,
  footerLeft,
  footerRight,
  gridHeight,
  className = '',
  stretchColumnId,
}: HandsontableGridProps<T>) {
  const {
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
  } = useHandsontableGridController({
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
  });

  return (
    <Stack
      gap="md"
      className={className}
      style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
    >
      {statsCards.length > 0 ? (
        <StatsCardGrid
          cards={statsCards}
          variant="vibrant"
          minCardWidth={220}
          spacing="md"
        />
      ) : null}

      <HandsontableGridToolbar
        searchQuery={searchQuery}
        onSearch={onSearch}
        searchPlaceholder={searchPlaceholder}
        enableCtrlF={enableCtrlF}
        searchInputRef={searchInputRef}
        onSearchFocus={handleSearchFocus}
        enableCSVImport={enableCSVImport}
        csvFile={csvFile}
        onFileChange={onFileChange}
        onCSVImport={() => {
          void handleCSVImport();
        }}
        actionButtons={actionButtons}
        secondarySearchControl={secondarySearchControl}
        searchRightButtons={searchRightButtons}
        searchBottomContent={searchBottomContent}
        stackActionsBelowSearch={stackActionsBelowSearch}
      />

      <HandsontableGridTable
        hotRef={hotRef}
        columns={columns}
        hotData={hotData}
        hotColumns={hotColumns}
        currentGridHeight={currentGridHeight}
        stretchColumnId={stretchColumnId}
        handleBeforeStretch={handleBeforeStretch}
        renderCell={renderCell}
        handleAfterBeginEditing={handleAfterBeginEditing}
        handleBeforeChange={handleBeforeChange}
        handleAfterChange={handleAfterChange}
        handleSelectionSummary={handleSelectionSummary}
        handleAfterSelectionEnd={handleAfterSelectionEnd}
        handleDeselect={handleDeselect}
      />

      {showFooter ? (
        <HandsontableGridFooter
          totalCount={data.length}
          filteredCount={filteredData.length}
          footerLeft={footerLeft}
          footerRight={footerRight}
        />
      ) : null}
    </Stack>
  );
}

export default HandsontableGrid;
