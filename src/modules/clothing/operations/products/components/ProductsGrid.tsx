'use client';

import dynamic from 'next/dynamic';
import { Stack } from '@mantine/core';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import { useProductsGrid } from '../hooks';
import { ProductsGridControls } from './ProductsGridControls';
import { ProductsGridFooter } from './ProductsGridFooter';

registerAllModules();

const AddProductModal = dynamic(
  () =>
    import('./AddProductModal').then((mod) => ({
      default: mod.AddProductModal,
    })),
  {
    ssr: false,
    loading: () => null,
  }
);

export function ProductsGrid() {
  const {
    searchQuery,
    handleSearch,
    isEditMode,
    toggleEditMode,
    addProductOpen,
    openCreateProductModal,
    closeProductModal,
    gridHeight,
    tableData,
    columns,
    handleAfterChange,
    handleCellClick,
    handleSubmitProduct,
    filteredProducts,
    products,
    statistics,
    productForm,
  } = useProductsGrid();

  return (
    <>
      <style>{`
        .ht-theme-horizon {
          --ht-font-size: 14px;
          --ht-line-height: 20px;
          --ht-font-weight: 400;
          --ht-letter-spacing: 0;
          --ht-gap-size: 6px;
          --ht-icon-size: 16px;
          --ht-table-transition: 0.2s;
          --ht-border-color: #e7e7e9;
          --ht-accent-color: #37bc6c;
          --ht-foreground-color: #353535;
          --ht-background-color: #ffffff;
          --ht-placeholder-color: #aeaeae;
          --ht-read-only-color: #727272;
          --ht-disabled-color: #aeaeae;
          --ht-cell-horizontal-border-color: rgba(255, 255, 255, 0);
          --ht-cell-vertical-border-color: #e7e7e9;
          --ht-wrapper-border-width: 0;
          --ht-wrapper-border-radius: 12px;
          --ht-wrapper-border-color: #e7e7e9;
          --ht-row-header-odd-background-color: rgba(255, 255, 255, 0);
          --ht-row-header-even-background-color: rgba(255, 255, 255, 0);
          --ht-row-cell-odd-background-color: rgba(255, 255, 255, 0);
          --ht-row-cell-even-background-color: rgba(255, 255, 255, 0);
          --ht-cell-horizontal-padding: 12px;
          --ht-cell-vertical-padding: 8px;
          --ht-cell-editor-border-width: 2px;
          --ht-cell-editor-border-color: #37bc6c;
          --ht-cell-editor-foreground-color: #070604;
          --ht-cell-editor-background-color: #ffffff;
          --ht-cell-editor-shadow-blur-radius: 8px;
          --ht-cell-editor-shadow-color: #37bc6c;
          --ht-cell-success-background-color: rgba(55, 188, 108, 0.30);
          --ht-cell-error-background-color: rgba(250, 77, 50, 0.30);
          --ht-cell-read-only-background-color: #ffffff;
          --ht-cell-selection-border-color: #37bc6c;
          --ht-cell-selection-background-color: #37bc6c;
          --ht-cell-autofill-size: 6px;
          --ht-cell-autofill-border-width: 1px;
          --ht-cell-autofill-border-radius: 4px;
          --ht-cell-autofill-border-color: #ffffff;
          --ht-cell-autofill-background-color: #37bc6c;
          --ht-cell-autofill-fill-border-color: #353535;
          --ht-cell-mobile-handle-size: 12px;
          --ht-cell-mobile-handle-border-width: 1px;
          --ht-cell-mobile-handle-border-radius: 6px;
          --ht-cell-mobile-handle-border-color: #37bc6c;
          --ht-cell-mobile-handle-background-color: rgba(55, 188, 108, 0.40);
          --ht-resize-indicator-color: #727272;
          --ht-move-backlight-color: rgba(35, 35, 38, 0.06);
          --ht-move-indicator-color: #37bc6c;
          --ht-hidden-indicator-color: #727272;
          --ht-scrollbar-border-radius: 8px;
          --ht-scrollbar-track-color: #f7f7f9;
          --ht-scrollbar-thumb-color: #aeaeae;
          --ht-header-font-weight: 400;
          --ht-header-foreground-color: #353535;
          --ht-header-background-color: #f7f7f9;
          --ht-header-highlighted-shadow-size: 1px;
          --ht-header-highlighted-foreground-color: #353535;
          --ht-header-highlighted-background-color: #ededef;
          --ht-header-active-border-color: #232326;
          --ht-header-active-foreground-color: #ffffff;
          --ht-header-active-background-color: #070604;
          --ht-header-filter-background-color: rgba(55, 188, 108, 0.30);
          --ht-header-row-foreground-color: #353535;
          --ht-header-row-background-color: #ffffff;
          --ht-header-row-highlighted-foreground-color: #353535;
          --ht-header-row-highlighted-background-color: #ededef;
          --ht-header-row-active-foreground-color: #ffffff;
          --ht-header-row-active-background-color: #070604;
        }

        .ht-theme-horizon tr:nth-child(even) td,
        .ht-theme-horizon tr:nth-child(odd) td {
          background-color: #ffffff !important;
        }

        .ht-theme-horizon tr:nth-child(even) th,
        .ht-theme-horizon tr:nth-child(odd) th {
          background-color: rgba(255, 255, 255, 0) !important;
        }
      `}</style>

      <Stack gap="md">
        <ProductsGridControls
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          isEditMode={isEditMode}
          onToggleEditMode={toggleEditMode}
          onAddProduct={openCreateProductModal}
        />

        <AddProductModal
          opened={addProductOpen}
          onClose={closeProductModal}
          form={productForm.form}
          updateField={productForm.updateField}
          calculations={productForm.calculations}
          onSubmit={handleSubmitProduct}
          isEditMode={productForm.isEditMode}
        />

        <div
          style={{
            height: gridHeight,
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <HotTable
            data={tableData}
            columns={columns}
            colHeaders
            rowHeaders
            width="100%"
            height={gridHeight}
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            contextMenu
            manualColumnResize
            manualRowResize
            filters
            dropdownMenu={false}
            afterChange={handleAfterChange}
            afterOnCellMouseDown={handleCellClick}
            minSpareRows={50}
            className="ht-theme-horizon htCenter htMiddle"
          />
        </div>

        <ProductsGridFooter
          filteredCount={filteredProducts.length}
          totalCount={products.length}
          totalValue={statistics.totalValue}
          totalProfit={statistics.totalProfit}
        />
      </Stack>
    </>
  );
}
