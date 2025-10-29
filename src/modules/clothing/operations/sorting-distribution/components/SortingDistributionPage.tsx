/**
 * Sorting Distribution Page Component
 *
 * Main page component for the Sorting Distribution module.
 * Displays product selection, statistics, quantity pill buttons, and the distribution grid.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import '@/styles/handsontable-horizon-light.css';
import { InfoSection } from './InfoSection';
import { QuantityPillButtons } from './QuantityPillButtons';
import { useSortingDistributionData } from '../hooks/useSortingDistributionData';
import { useSortingDistributionForm } from '../hooks/useSortingDistributionForm';

// Register Handsontable modules
registerAllModules();

/**
 * Sorting Distribution Page Component
 */
export function SortingDistributionPage() {
  const hotTableRef = useRef(null);

  // Form state
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null);

  // State for product selection
  const [productCode, setProductCode] = useState<string>('');

  // Initialize data hook
  const dataHook = useSortingDistributionData({
    productCode,
    selectedQuantity,
    onSelectedQuantityChange: setSelectedQuantity,
  });

  // Initialize form hook with loaded products
  const form = useSortingDistributionForm({
    allProducts: dataHook.allProducts,
  });

  // Sync product code between form and data hook
  const handleItemChange = useCallback(
    (item: string) => {
      form.setItem(item);
      setProductCode(item);
    },
    [form]
  );

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
      // Call default text renderer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textRenderer = (window as any).Handsontable?.renderers?.TextRenderer;
      if (textRenderer) {
        textRenderer(instance, td, row, col, prop, value, cellProperties);
      } else {
        td.textContent = value !== null && value !== undefined ? String(value) : '';
      }
      
      // Apply center alignment
      td.style.textAlign = 'center';
      td.style.verticalAlign = 'middle';
      
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
          unknown
        ];
        if (oldValue === newValue) {
          return;
        }

        if (prop === 'quantity') {
          // Quantity column
          dataHook.updateRowQuantity(row, Number(newValue) || 0);
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
          onItemChange={handleItemChange}
        />

        {/* Quantity Pill Buttons */}
        <QuantityPillButtons
          uniqueQuantities={dataHook.uniqueQuantities}
          selectedQuantity={selectedQuantity}
          onSelectQuantity={setSelectedQuantity}
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
              'Check',
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
          />
        </div>
      </Stack>
    </PageLayout>
  );
}
