'use client';

/**
 * Shipping Fee Calculator Component
 * Calculate shipping fees for products
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const PERSISTED_SHIPMENT_CODE_KEY =
  'shippingFeeCalculator:selectedShipmentCode';
import { Stack, Card, Group, NumberInput, Title, Select } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { HotTable } from '@handsontable/react';
import type { HotTableClass } from '@handsontable/react';
import type { CellChange, ChangeSource } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { useShipmentsData } from '../../shipments/hooks/useShipmentsData';
import { useProductsData } from '../hooks/useProductsData';

// Register Handsontable modules
registerAllModules();

interface ShippingFeeData {
  productCode: string;
  actualQuantity: number | null;
  multiplier: number | null;
  aproxQuantity: number | null;
  percentage: number | null;
  alibabaShippingCost: number | null;
  forwardersFee: number | null;
  lalamove: number | null;
  packaging: number | null;
}

interface ShippingFeeStateResponse {
  shipmentCode: string;
  actualAlibabaShipping: number;
  actualForwardersFee: number;
  actualLalamove: number;
  multipliers: Record<string, number>;
}

export function ShippingFeeCalculator() {
  // Get shipments data to extract shipment codes that are not delivered
  const { shipments } = useShipmentsData();
  // Get products data to filter by shipment code
  const { products } = useProductsData();

  const [data, setData] = useState<ShippingFeeData[]>([
    {
      productCode: '',
      actualQuantity: null,
      multiplier: null,
      aproxQuantity: null,
      percentage: null,
      alibabaShippingCost: null,
      forwardersFee: null,
      lalamove: null,
      packaging: null,
    },
  ]);
  const [gridHeight, setGridHeight] = useState(600);
  const hotTableRef = useRef<HotTableClass>(null);
  const hasRestoredShipmentCode = useRef(false);

  // Actual shipping fees state
  const [actualAlibabaShipping, setActualAlibabaShipping] = useState<
    number | string
  >('');
  const [actualForwardersFee, setActualForwardersFee] = useState<
    number | string
  >('');
  const [actualLalamove, setActualLalamove] = useState<number | string>('');

  // Selected shipment code
  const [selectedShipmentCode, setSelectedShipmentCode] = useState<
    string | null
  >(null);

  // Extract unique shipment codes from shipments where status is NOT "Delivered"
  const shipmentCodes = Array.from(
    new Set(
      shipments
        .filter((s) => s['Shipment Status'] !== 'Delivered')
        .map((s) => s['Shipment Code'])
        .filter((code) => code && code.trim() !== '')
    )
  ).sort();

  // Set grid height on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGridHeight(window.innerHeight * 0.7);
    }
  }, []);

  // Load saved data when shipment code is selected
  const loadSavedState = useCallback(async (shipmentCode: string) => {
    try {
      const response = await fetch(
        `/api/clothing/operations/products/shipping-fee-calculator?shipmentCode=${encodeURIComponent(shipmentCode)}`
      );
      if (!response.ok) {
        throw new Error('Request failed');
      }

      const result = await response.json();

      if (result.data) {
        const rawMultipliers =
          (result.data.multipliers as Record<string, unknown>) || {};

        const normalizedMultipliers = Object.entries(rawMultipliers).reduce<
          Record<string, number>
        >((acc, [key, value]) => {
          const code = key.trim();
          if (!code) {
            return acc;
          }

          const numericValue = Number(value);
          if (Number.isFinite(numericValue)) {
            acc[code] = numericValue;
          }

          return acc;
        }, {});

        const savedState: ShippingFeeStateResponse = {
          shipmentCode: result.data.shipmentCode,
          actualAlibabaShipping: Number(result.data.actualAlibabaShipping) || 0,
          actualForwardersFee: Number(result.data.actualForwardersFee) || 0,
          actualLalamove: Number(result.data.actualLalamove) || 0,
          multipliers: normalizedMultipliers,
        };

        return savedState;
      }

      return null;
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load saved data',
        color: 'red',
      });
      return null;
    }
  }, []);

  // Save data to database
  const saveData = useCallback(
    async (
      currentData: ShippingFeeData[],
      shipmentCode: string,
      alibaba: number | string,
      forwarders: number | string,
      lalamove: number | string
    ) => {
      if (!shipmentCode) {
        return;
      }

      const toNumber = (value: number | string): number => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string' && value.trim() !== '') {
          const parsed = Number(value.replace(/,/g, ''));
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      const multipliersPayload = currentData.reduce<Record<string, number>>(
        (acc, row) => {
          if (!row.productCode || row.multiplier === null) {
            return acc;
          }

          const numericValue =
            typeof row.multiplier === 'number'
              ? row.multiplier
              : Number(row.multiplier);

          if (Number.isFinite(numericValue)) {
            acc[row.productCode] = numericValue;
          }

          return acc;
        },
        {}
      );

      try {
        const response = await fetch(
          '/api/clothing/operations/products/shipping-fee-calculator',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shipmentCode,
              actualInputs: {
                actualAlibabaShipping: toNumber(alibaba),
                actualForwardersFee: toNumber(forwarders),
                actualLalamove: toNumber(lalamove),
              },
              multipliers: multipliersPayload,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to save');
        }

        showNotification({
          title: 'Saved',
          message: 'Data saved successfully',
          color: 'green',
        });
      } catch (error) {
        showNotification({
          title: 'Error',
          message: 'Failed to save data',
          color: 'red',
        });
      }
    },
    []
  );

  const handleShipmentCodeChange = useCallback((value: string | null) => {
    setSelectedShipmentCode(value);

    if (typeof window === 'undefined') {
      return;
    }

    if (value) {
      window.localStorage.setItem(PERSISTED_SHIPMENT_CODE_KEY, value);
    } else {
      window.localStorage.removeItem(PERSISTED_SHIPMENT_CODE_KEY);
    }
  }, []);

  // Populate table with products when shipment code is selected
  useEffect(() => {
    if (!selectedShipmentCode) {
      setData([
        {
          productCode: '',
          actualQuantity: null,
          multiplier: null,
          aproxQuantity: null,
          percentage: null,
          alibabaShippingCost: null,
          forwardersFee: null,
          lalamove: null,
          packaging: null,
        },
      ]);
      setActualAlibabaShipping('');
      setActualForwardersFee('');
      setActualLalamove('');
      return;
    }

    const initialize = async () => {
      const savedState = await loadSavedState(selectedShipmentCode);

      if (savedState) {
        setActualAlibabaShipping(savedState.actualAlibabaShipping ?? 0);
        setActualForwardersFee(savedState.actualForwardersFee ?? 0);
        setActualLalamove(savedState.actualLalamove ?? 0);
      } else {
        setActualAlibabaShipping('');
        setActualForwardersFee('');
        setActualLalamove('');
      }

      const filteredProducts = products.filter(
        (p) => p['Shipment Code'] === selectedShipmentCode
      );

      const multipliersMap = savedState?.multipliers || {};

      const newData: ShippingFeeData[] = filteredProducts.map((product) => {
        const productCode = product['Product Code'] || '';
        const multiplierValue = multipliersMap[productCode];

        return {
          productCode,
          actualQuantity: product['Quantity'] || 0,
          multiplier:
            typeof multiplierValue === 'number' &&
            Number.isFinite(multiplierValue)
              ? multiplierValue
              : null,
          aproxQuantity: null,
          percentage: null,
          alibabaShippingCost: null,
          forwardersFee: null,
          lalamove: null,
          packaging: null,
        };
      });

      if (newData.length === 0) {
        newData.push({
          productCode: '',
          actualQuantity: null,
          multiplier: null,
          aproxQuantity: null,
          percentage: null,
          alibabaShippingCost: null,
          forwardersFee: null,
          lalamove: null,
          packaging: null,
        });
      }

      setData(newData);
    };

    void initialize();
  }, [selectedShipmentCode, products, loadSavedState]);

  useEffect(() => {
    if (hasRestoredShipmentCode.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (shipmentCodes.length === 0) {
      return;
    }

    const storedCode = window.localStorage.getItem(PERSISTED_SHIPMENT_CODE_KEY);

    if (storedCode && shipmentCodes.includes(storedCode)) {
      setSelectedShipmentCode(storedCode);
    } else if (storedCode) {
      window.localStorage.removeItem(PERSISTED_SHIPMENT_CODE_KEY);
    }

    hasRestoredShipmentCode.current = true;
  }, [shipmentCodes]);

  // Recalculate shipping costs when input amounts change
  useEffect(() => {
    if (!selectedShipmentCode) {
      return;
    }

    const hot = hotTableRef.current?.hotInstance;
    const hasProducts = data.some((row) => row.productCode);

    if (!hot || !hasProducts) {
      saveData(
        data,
        selectedShipmentCode,
        actualAlibabaShipping,
        actualForwardersFee,
        actualLalamove
      );
      return;
    }

    const updatedData = hot.getData() as unknown[][];

    const firstPassData: ShippingFeeData[] = updatedData.map((row) => {
      const actualQuantity = row[1] ? Number(row[1]) : null;
      const multiplier = row[2] ? Number(row[2]) : null;

      const aproxQuantity =
        actualQuantity !== null && multiplier !== null
          ? actualQuantity * multiplier
          : null;

      return {
        productCode: (row[0] as string) || '',
        actualQuantity,
        multiplier,
        aproxQuantity,
        percentage: null,
        alibabaShippingCost: null,
        forwardersFee: null,
        lalamove: null,
        packaging: null,
      };
    });

    const totalAproxQuantity = firstPassData.reduce((sum, row) => {
      return sum + (row.aproxQuantity || 0);
    }, 0);

    const alibabaShippingInput =
      typeof actualAlibabaShipping === 'number' ? actualAlibabaShipping : 0;

    const forwardersFeeInput =
      typeof actualForwardersFee === 'number' ? actualForwardersFee : 0;

    const lalamoveInput =
      typeof actualLalamove === 'number' ? actualLalamove : 0;

    const newData: ShippingFeeData[] = firstPassData.map((row) => {
      const percentage =
        row.aproxQuantity !== null && totalAproxQuantity > 0
          ? row.aproxQuantity / totalAproxQuantity
          : null;

      const alibabaShippingCost =
        percentage !== null && alibabaShippingInput > 0
          ? alibabaShippingInput * percentage
          : null;

      const forwardersFee =
        percentage !== null && forwardersFeeInput > 0
          ? forwardersFeeInput * percentage
          : null;

      const lalamove =
        percentage !== null && lalamoveInput > 0
          ? lalamoveInput * percentage
          : null;

      const packaging = lalamove;

      return {
        ...row,
        percentage,
        alibabaShippingCost,
        forwardersFee,
        lalamove,
        packaging,
      };
    });

    setData(newData);

    saveData(
      newData,
      selectedShipmentCode,
      actualAlibabaShipping,
      actualForwardersFee,
      actualLalamove
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualAlibabaShipping, actualForwardersFee, actualLalamove]);

  const columns = [
    {
      data: 'productCode',
      type: 'text',
      title: 'PRODUCT CODE',
      width: 300,
      readOnly: true,
    },
    {
      data: 'actualQuantity',
      type: 'numeric',
      title: 'ACTUAL QUANTITY',
      width: 150,
      numericFormat: {
        pattern: '0,0',
      },
      readOnly: true,
    },
    {
      data: 'multiplier',
      type: 'numeric',
      title: 'MULTIPLIER',
      width: 120,
      numericFormat: {
        pattern: '0,0.00',
      },
      readOnly: false,
    },
    {
      data: 'aproxQuantity',
      type: 'numeric',
      title: 'APROX. QUANTITY',
      width: 150,
      numericFormat: {
        pattern: '0,0',
      },
      readOnly: true,
    },
    {
      data: 'percentage',
      type: 'numeric',
      title: 'PERCENTAGE',
      width: 130,
      numericFormat: {
        pattern: '0.00%',
      },
      readOnly: true,
    },
    {
      data: 'alibabaShippingCost',
      type: 'numeric',
      title: 'ALIBABA SHIPPING COST',
      width: 200,
      numericFormat: {
        pattern: '₱0,0.00',
      },
      readOnly: true,
    },
    {
      data: 'forwardersFee',
      type: 'numeric',
      title: "FORWARDER'S FEE",
      width: 170,
      numericFormat: {
        pattern: '₱0,0.00',
      },
      readOnly: true,
    },
    {
      data: 'lalamove',
      type: 'numeric',
      title: 'LALAMOVE',
      width: 140,
      numericFormat: {
        pattern: '₱0,0.00',
      },
      readOnly: true,
    },
    {
      data: 'packaging',
      type: 'numeric',
      title: 'PACKAGING',
      width: 140,
      numericFormat: {
        pattern: '₱0,0.00',
      },
      readOnly: true,
    },
  ];

  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (!changes || source === 'loadData') {
        return;
      }

      // Update data state when cells are edited
      const hot = hotTableRef.current?.hotInstance;
      if (hot) {
        const updatedData = hot.getData() as unknown[][];

        // First pass: Calculate APROX. QUANTITY for all rows
        const firstPassData: ShippingFeeData[] = updatedData.map((row) => {
          const actualQuantity = row[1] ? Number(row[1]) : null;
          const multiplier = row[2] ? Number(row[2]) : null;

          // Calculate APROX. QUANTITY = ACTUAL QUANTITY * MULTIPLIER
          const aproxQuantity =
            actualQuantity !== null && multiplier !== null
              ? actualQuantity * multiplier
              : null;

          return {
            productCode: (row[0] as string) || '',
            actualQuantity,
            multiplier,
            aproxQuantity,
            percentage: null,
            alibabaShippingCost: null,
            forwardersFee: row[6] ? Number(row[6]) : null,
            lalamove: row[7] ? Number(row[7]) : null,
            packaging: row[8] ? Number(row[8]) : null,
          };
        });

        // Calculate total APROX. QUANTITY for percentage calculation
        const totalAproxQuantity = firstPassData.reduce((sum, row) => {
          return sum + (row.aproxQuantity || 0);
        }, 0);

        // Get actual shipping cost input value
        const alibabaShippingInput =
          typeof actualAlibabaShipping === 'number' ? actualAlibabaShipping : 0;

        const forwardersFeeInput =
          typeof actualForwardersFee === 'number' ? actualForwardersFee : 0;

        const lalamoveInput =
          typeof actualLalamove === 'number' ? actualLalamove : 0;

        // Second pass: Calculate PERCENTAGE and ALIBABA SHIPPING COST for each row
        const newData: ShippingFeeData[] = firstPassData.map((row) => {
          // Calculate PERCENTAGE = (APROX. QUANTITY / SUM OF ALL APROX. QUANTITY)
          const percentage =
            row.aproxQuantity !== null && totalAproxQuantity > 0
              ? row.aproxQuantity / totalAproxQuantity
              : null;

          // Calculate ALIBABA SHIPPING COST = "Alibaba Shipping Cost" INPUT * PERCENTAGE
          const alibabaShippingCost =
            percentage !== null && alibabaShippingInput > 0
              ? alibabaShippingInput * percentage
              : null;

          // Calculate FORWARDER'S FEE = "Forwarder's Fee" INPUT * PERCENTAGE
          const forwardersFee =
            percentage !== null && forwardersFeeInput > 0
              ? forwardersFeeInput * percentage
              : null;

          // Calculate LALAMOVE = "Lalamove" INPUT * PERCENTAGE
          const lalamove =
            percentage !== null && lalamoveInput > 0
              ? lalamoveInput * percentage
              : null;

          // PACKAGING = same as LALAMOVE
          const packaging = lalamove;

          return {
            ...row,
            percentage,
            alibabaShippingCost,
            forwardersFee,
            lalamove,
            packaging,
          };
        });

        setData(newData);

        // Auto-save after table edit
        if (selectedShipmentCode) {
          saveData(
            newData,
            selectedShipmentCode,
            actualAlibabaShipping,
            actualForwardersFee,
            actualLalamove
          );
        }
      }
    },
    [
      actualAlibabaShipping,
      actualForwardersFee,
      actualLalamove,
      selectedShipmentCode,
      saveData,
    ]
  );

  return (
    <Stack gap="md">
      <style>{`
        .ht-theme-main {
          --ht-font-size: 14px;
          --ht-line-height: 20px;
          --ht-font-weight: 400;
          --ht-letter-spacing: 0;
          --ht-gap-size: 4px;
          --ht-icon-size: 16px;
          --ht-table-transition: 0.15s;
          --ht-border-color: #e7e7e9;
          --ht-accent-color: #1a42e8;
          --ht-foreground-color: #222222;
          --ht-background-color: #ffffff;
          --ht-placeholder-color: #a3a3a3;
          --ht-read-only-color: #68696c;
          --ht-disabled-color: #a3a3a3;
          --ht-cell-horizontal-border-color: #e7e7e9;
          --ht-cell-vertical-border-color: #e7e7e9;
          --ht-wrapper-border-width: 0;
          --ht-wrapper-border-radius: 4px;
          --ht-wrapper-border-color: #e7e7e9;
          --ht-row-header-odd-background-color: #f7f7f9;
          --ht-row-header-even-background-color: #f7f7f9;
          --ht-row-cell-odd-background-color: rgba(255, 255, 255, 0);
          --ht-row-cell-even-background-color: rgba(255, 255, 255, 0);
          --ht-cell-horizontal-padding: 8px;
          --ht-cell-vertical-padding: 4px;
          --ht-cell-editor-border-width: 2px;
          --ht-cell-editor-border-color: #1a42e8;
          --ht-cell-editor-foreground-color: #0f0f10;
          --ht-cell-editor-background-color: #ffffff;
          --ht-cell-editor-shadow-blur-radius: 0;
          --ht-cell-editor-shadow-color: #1a42e8;
          --ht-cell-success-background-color: rgba(55, 188, 108, 0.20);
          --ht-cell-error-background-color: rgba(250, 77, 50, 0.20);
          --ht-cell-read-only-background-color: rgba(34, 34, 34, 0.04);
          --ht-cell-selection-border-color: #1a42e8;
          --ht-cell-selection-background-color: #5371ee;
          --ht-cell-autofill-size: 6px;
          --ht-cell-autofill-border-width: 1px;
          --ht-cell-autofill-border-radius: 4px;
          --ht-cell-autofill-border-color: #ffffff;
          --ht-cell-autofill-background-color: #1a42e8;
          --ht-cell-autofill-fill-border-color: #222222;
          --ht-cell-mobile-handle-size: 12px;
          --ht-cell-mobile-handle-border-width: 1px;
          --ht-cell-mobile-handle-border-radius: 6px;
          --ht-cell-mobile-handle-border-color: #1a42e8;
          --ht-cell-mobile-handle-background-color: rgba(26, 66, 232, 0.40);
          --ht-resize-indicator-color: rgba(34, 34, 34, 0.40);
          --ht-move-backlight-color: rgba(34, 34, 34, 0.08);
          --ht-move-indicator-color: #1a42e8;
          --ht-hidden-indicator-color: rgba(34, 34, 34, 0.40);
          --ht-scrollbar-border-radius: 8px;
          --ht-scrollbar-track-color: #f7f7f9;
          --ht-scrollbar-thumb-color: #a3a3a3;
          --ht-header-font-weight: 400;
          --ht-header-foreground-color: #222222;
          --ht-header-background-color: #f7f7f9;
          --ht-header-highlighted-shadow-size: 0;
          --ht-header-highlighted-foreground-color: #0f0f10;
          --ht-header-highlighted-background-color: #ebebed;
          --ht-header-active-border-color: #2e56fc;
          --ht-header-active-foreground-color: #ffffff;
          --ht-header-active-background-color: #1a42e8;
          --ht-header-filter-background-color: rgba(55, 188, 108, 0.20);
          --ht-header-row-foreground-color: #222222;
          --ht-header-row-background-color: #f7f7f9;
          --ht-header-row-highlighted-foreground-color: #0f0f10;
          --ht-header-row-highlighted-background-color: #ebebed;
          --ht-header-row-active-foreground-color: #ffffff;
          --ht-header-row-active-background-color: #1a42e8;
          --ht-checkbox-size: 16px;
          --ht-checkbox-border-radius: 4px;
          --ht-checkbox-border-color: #d1d1d5;
          --ht-checkbox-background-color: #ffffff;
          --ht-checkbox-icon-color: rgba(255, 255, 255, 0);
          --ht-checkbox-focus-border-color: #d1d1d5;
          --ht-checkbox-focus-background-color: #ffffff;
          --ht-checkbox-focus-icon-color: rgba(255, 255, 255, 0);
          --ht-checkbox-focus-ring-color: #1a42e8;
          --ht-checkbox-disabled-border-color: #e7e7e9;
          --ht-checkbox-disabled-background-color: #d1d1d5;
          --ht-checkbox-disabled-icon-color: rgba(255, 255, 255, 0);
          --ht-checkbox-checked-border-color: #2e56fc;
          --ht-checkbox-checked-background-color: #1a42e8;
          --ht-checkbox-checked-icon-color: #ffffff;
          --ht-checkbox-checked-focus-border-color: #ffffff;
          --ht-checkbox-checked-focus-background-color: #1a42e8;
          --ht-checkbox-checked-focus-icon-color: #ffffff;
          --ht-checkbox-checked-disabled-border-color: #e7e7e9;
          --ht-checkbox-checked-disabled-background-color: #d1d1d5;
          --ht-checkbox-checked-disabled-icon-color: #a3a3a3;
          --ht-checkbox-indeterminate-border-color: #2e56fc;
          --ht-checkbox-indeterminate-background-color: #1a42e8;
          --ht-checkbox-indeterminate-icon-color: #ffffff;
          --ht-checkbox-indeterminate-focus-border-color: #ffffff;
          --ht-checkbox-indeterminate-focus-background-color: #1a42e8;
          --ht-checkbox-indeterminate-focus-icon-color: #ffffff;
          --ht-checkbox-indeterminate-disabled-border-color: #e7e7e9;
          --ht-checkbox-indeterminate-disabled-background-color: #d1d1d5;
          --ht-checkbox-indeterminate-disabled-icon-color: #aeaeae;
          --ht-radio-size: 16px;
          --ht-radio-border-color: #d1d1d5;
          --ht-radio-background-color: #ffffff;
          --ht-radio-icon-color: rgba(255, 255, 255, 0);
          --ht-radio-focus-border-color: #e7e7e9;
          --ht-radio-focus-background-color: #ffffff;
          --ht-radio-focus-icon-color: rgba(255, 255, 255, 0);
          --ht-radio-focus-ring-color: #1a42e8;
          --ht-radio-disabled-border-color: #e7e7e9;
          --ht-radio-disabled-background-color: #d1d1d5;
          --ht-radio-disabled-icon-color: rgba(255, 255, 255, 0);
          --ht-radio-checked-border-color: #1a42e8;
          --ht-radio-checked-background-color: #ffffff;
          --ht-radio-checked-icon-color: #1a42e8;
          --ht-radio-checked-focus-border-color: #2e56fc;
          --ht-radio-checked-focus-background-color: #ffffff;
          --ht-radio-checked-focus-icon-color: #2e56fc;
          --ht-radio-checked-disabled-border-color: #e7e7e9;
          --ht-radio-checked-disabled-background-color: #d1d1d5;
          --ht-radio-checked-disabled-icon-color: #a3a3a3;
          --ht-icon-button-border-radius: 2px;
          --ht-icon-button-border-color: #f7f7f9;
          --ht-icon-button-background-color: #f7f7f9;
          --ht-icon-button-icon-color: rgba(34, 34, 34, 0.40);
          --ht-icon-button-hover-border-color: #e7e7e9;
          --ht-icon-button-hover-background-color: #e7e7e9;
          --ht-icon-button-hover-icon-color: rgba(34, 34, 34, 0.40);
          --ht-icon-button-active-border-color: #1a42e8;
          --ht-icon-button-active-background-color: #1a42e8;
          --ht-icon-button-active-icon-color: #ffffff;
          --ht-icon-button-active-hover-border-color: #2e56fc;
          --ht-icon-button-active-hover-background-color: #2e56fc;
          --ht-icon-button-active-hover-icon-color: #ffffff;
          --ht-collapse-button-border-radius: 4px;
          --ht-collapse-button-open-border-color: #d1d1d5;
          --ht-collapse-button-open-background-color: #ffffff;
          --ht-collapse-button-open-icon-color: #68696c;
          --ht-collapse-button-open-icon-active-color: #68696c;
          --ht-collapse-button-open-hover-border-color: #d1d1d5;
          --ht-collapse-button-open-hover-background-color: #f7f7f9;
          --ht-collapse-button-open-hover-icon-color: #68696c;
          --ht-collapse-button-open-hover-icon-active-color: #68696c;
          --ht-collapse-button-close-border-color: #d1d1d5;
          --ht-collapse-button-close-background-color: #ebebed;
          --ht-collapse-button-close-icon-color: #68696c;
          --ht-collapse-button-close-icon-active-color: #68696c;
          --ht-collapse-button-close-hover-border-color: #d1d1d5;
          --ht-collapse-button-close-hover-background-color: #ebebed;
          --ht-collapse-button-close-hover-icon-color: #68696c;
          --ht-collapse-button-close-hover-icon-active-color: #68696c;
          --ht-button-border-radius: 4px;
          --ht-button-horizontal-padding: 12px;
          --ht-button-vertical-padding: 6px;
          --ht-primary-button-border-color: rgba(255, 255, 255, 0);
          --ht-primary-button-foreground-color: #ffffff;
          --ht-primary-button-background-color: #1a42e8;
          --ht-primary-button-disabled-border-color: rgba(255, 255, 255, 0);
          --ht-primary-button-disabled-foreground-color: #a3a3a3;
          --ht-primary-button-disabled-background-color: #ebebed;
          --ht-primary-button-hover-border-color: rgba(255, 255, 255, 0);
          --ht-primary-button-hover-foreground-color: #ffffff;
          --ht-primary-button-hover-background-color: #1535bc;
          --ht-primary-button-focus-border-color: #ffffff;
          --ht-primary-button-focus-foreground-color: #ffffff;
          --ht-primary-button-focus-background-color: #1a42e8;
          --ht-secondary-button-border-color: #e7e7e9;
          --ht-secondary-button-foreground-color: #222222;
          --ht-secondary-button-background-color: #ffffff;
          --ht-secondary-button-disabled-border-color: #e7e7e9;
          --ht-secondary-button-disabled-foreground-color: #a3a3a3;
          --ht-secondary-button-disabled-background-color: #ebebed;
          --ht-secondary-button-hover-border-color: #e7e7e9;
          --ht-secondary-button-hover-foreground-color: #222222;
          --ht-secondary-button-hover-background-color: #e7e7e9;
          --ht-secondary-button-focus-border-color: #e7e7e9;
          --ht-secondary-button-focus-foreground-color: #222222;
          --ht-secondary-button-focus-background-color: #ffffff;
          --ht-comments-textarea-horizontal-padding: 8px;
          --ht-comments-textarea-vertical-padding: 4px;
          --ht-comments-textarea-border-width: 1px;
          --ht-comments-textarea-border-color: rgba(255, 255, 255, 0);
          --ht-comments-textarea-foreground-color: #222222;
          --ht-comments-textarea-background-color: #f7f7f9;
          --ht-comments-textarea-focus-border-width: 1px;
          --ht-comments-textarea-focus-border-color: #1a42e8;
          --ht-comments-textarea-focus-foreground-color: #222222;
          --ht-comments-textarea-focus-background-color: #ffffff;
          --ht-comments-indicator-size: 6px;
          --ht-comments-indicator-color: #1a42e8;
          --ht-license-horizontal-padding: 16px;
          --ht-license-vertical-padding: 8px;
          --ht-license-foreground-color: #222222;
          --ht-license-background-color: #f7f7f9;
          --ht-link-color: #1a42e8;
          --ht-link-hover-color: #5371ee;
          --ht-input-border-width: 1px;
          --ht-input-border-radius: 4px;
          --ht-input-horizontal-padding: 12px;
          --ht-input-vertical-padding: 6px;
          --ht-input-border-color: #e7e7e9;
          --ht-input-foreground-color: #222222;
          --ht-input-background-color: #f7f7f9;
          --ht-input-hover-border-color: #e7e7e9;
          --ht-input-hover-foreground-color: #222222;
          --ht-input-hover-background-color: #ffffff;
          --ht-input-disabled-border-color: #e7e7e9;
          --ht-input-disabled-foreground-color: #a3a3a3;
          --ht-input-disabled-background-color: #d1d1d5;
          --ht-input-focus-border-color: #1a42e8;
          --ht-input-focus-foreground-color: #222222;
          --ht-input-focus-background-color: #ffffff;
          --ht-menu-border-width: 1px;
          --ht-menu-border-radius: 4px;
          --ht-menu-horizontal-padding: 0;
          --ht-menu-vertical-padding: 8px;
          --ht-menu-item-horizontal-padding: 12px;
          --ht-menu-item-vertical-padding: 4px;
          --ht-menu-border-color: #e7e7e9;
          --ht-menu-shadow-x: 0;
          --ht-menu-shadow-y: 8px;
          --ht-menu-shadow-blur: 16px;
          --ht-menu-shadow-color: rgba(34, 34, 34, 0.08);
          --ht-menu-item-hover-color: rgba(34, 34, 34, 0.04);
          --ht-menu-item-active-color: rgba(34, 34, 34, 0.08);
        }
      `}</style>

      <Card withBorder padding="xl">
        <Group justify="space-between" align="flex-start">
          {/* Left side - Actual Shipping Fees inputs */}
          <Stack gap="xs" style={{ flex: 1 }}>
            <Title order={4} c="dimmed">
              ACTUAL SHIPPING FEES
            </Title>
            <NumberInput
              label="Alibaba Shipping Cost"
              placeholder="Enter amount"
              value={actualAlibabaShipping}
              onChange={setActualAlibabaShipping}
              prefix="₱"
              thousandSeparator=","
              decimalScale={2}
              fixedDecimalScale
              size="md"
            />
            <NumberInput
              label="Forwarder's Fee (KPC)"
              placeholder="Enter amount"
              value={actualForwardersFee}
              onChange={setActualForwardersFee}
              prefix="₱"
              thousandSeparator=","
              decimalScale={2}
              fixedDecimalScale
              size="md"
            />
            <NumberInput
              label="Lalamove"
              placeholder="Enter amount"
              value={actualLalamove}
              onChange={setActualLalamove}
              prefix="₱"
              thousandSeparator=","
              decimalScale={2}
              fixedDecimalScale
              size="md"
            />
          </Stack>

          {/* Right side - Shipment Code Details */}
          <Stack gap="xs" style={{ flex: 1 }}>
            <Title order={4} c="dimmed">
              SHIPMENT CODE DETAILS
            </Title>
            <Select
              label="Select Shipment Code from the dropdown"
              placeholder="Choose a shipment code"
              data={shipmentCodes}
              value={selectedShipmentCode}
              onChange={handleShipmentCodeChange}
              searchable
              clearable
              size="md"
              maxDropdownHeight={400}
            />
          </Stack>
        </Group>
      </Card>

      <Card
        withBorder
        shadow="sm"
        radius="md"
        padding={0}
        style={{
          height: gridHeight,
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
        }}
      >
        <HotTable
          ref={hotTableRef}
          data={data}
          columns={columns}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height={gridHeight}
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          contextMenu={true}
          manualColumnResize={true}
          manualRowResize={true}
          filters={true}
          dropdownMenu={true}
          afterChange={handleAfterChange}
          minSpareRows={1}
          className="ht-theme-main htCenter htMiddle"
        />
      </Card>
    </Stack>
  );
}
