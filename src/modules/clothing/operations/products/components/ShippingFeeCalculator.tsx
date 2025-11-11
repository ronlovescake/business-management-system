'use client';

/**
 * Shipping Fee Calculator Component
 * Calculate shipping fees for products
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const PERSISTED_SHIPMENT_CODE_KEY =
  'shippingFeeCalculator:selectedShipmentCode';
import {
  Stack,
  Card,
  NumberInput,
  Select,
  SimpleGrid,
  Flex,
  Text,
  Paper,
  Title,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { HotTable } from '@handsontable/react';
import type { HotTableClass } from '@handsontable/react';
import type { CellChange, ChangeSource } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
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
          --ht-row-header-even-background-color: rgba(35, 35, 38, 0.04);
          --ht-row-cell-odd-background-color: rgba(255, 255, 255, 0);
          --ht-row-cell-even-background-color: rgba(35, 35, 38, 0.04);
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
          --ht-cell-read-only-background-color: rgba(35, 35, 38, 0.04);
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
          --ht-checkbox-size: 16px;
          --ht-checkbox-border-radius: 6px;
          --ht-checkbox-border-color: #aeaeae;
          --ht-checkbox-background-color: #ffffff;
          --ht-checkbox-icon-color: rgba(255, 255, 255, 0);
          --ht-checkbox-focus-border-color: #aeaeae;
          --ht-checkbox-focus-background-color: #ffffff;
          --ht-checkbox-focus-icon-color: rgba(255, 255, 255, 0);
          --ht-checkbox-focus-ring-color: #37bc6c;
          --ht-checkbox-disabled-border-color: #aeaeae;
          --ht-checkbox-disabled-background-color: #f7f7f9;
          --ht-checkbox-disabled-icon-color: rgba(255, 255, 255, 0);
          --ht-checkbox-checked-border-color: #57c784;
          --ht-checkbox-checked-background-color: #37bc6c;
          --ht-checkbox-checked-icon-color: #ffffff;
          --ht-checkbox-checked-focus-border-color: #ffffff;
          --ht-checkbox-checked-focus-background-color: #37bc6c;
          --ht-checkbox-checked-focus-icon-color: #ffffff;
          --ht-checkbox-checked-disabled-border-color: #aeaeae;
          --ht-checkbox-checked-disabled-background-color: #f7f7f9;
          --ht-checkbox-checked-disabled-icon-color: #aeaeae;
          --ht-checkbox-indeterminate-border-color: #57c784;
          --ht-checkbox-indeterminate-background-color: #37bc6c;
          --ht-checkbox-indeterminate-icon-color: #ffffff;
          --ht-checkbox-indeterminate-focus-border-color: #ffffff;
          --ht-checkbox-indeterminate-focus-background-color: #37bc6c;
          --ht-checkbox-indeterminate-focus-icon-color: #ffffff;
          --ht-checkbox-indeterminate-disabled-border-color: #aeaeae;
          --ht-checkbox-indeterminate-disabled-background-color: #f7f7f9;
          --ht-checkbox-indeterminate-disabled-icon-color: #aeaeae;
          --ht-radio-size: 16px;
          --ht-radio-border-color: #aeaeae;
          --ht-radio-background-color: #ffffff;
          --ht-radio-icon-color: rgba(255, 255, 255, 0);
          --ht-radio-focus-border-color: #aeaeae;
          --ht-radio-focus-background-color: #ffffff;
          --ht-radio-focus-icon-color: rgba(255, 255, 255, 0);
          --ht-radio-focus-ring-color: #37bc6c;
          --ht-radio-disabled-border-color: #aeaeae;
          --ht-radio-disabled-background-color: #f7f7f9;
          --ht-radio-disabled-icon-color: rgba(255, 255, 255, 0);
          --ht-radio-checked-border-color: #37bc6c;
          --ht-radio-checked-background-color: #ffffff;
          --ht-radio-checked-icon-color: #37bc6c;
          --ht-radio-checked-focus-border-color: #57c784;
          --ht-radio-checked-focus-background-color: #ffffff;
          --ht-radio-checked-focus-icon-color: #37bc6c;
          --ht-radio-checked-disabled-border-color: #aeaeae;
          --ht-radio-checked-disabled-background-color: #f7f7f9;
          --ht-radio-checked-disabled-icon-color: #aeaeae;
          --ht-icon-button-border-radius: 16px;
          --ht-icon-button-border-color: #f7f7f9;
          --ht-icon-button-background-color: #f7f7f9;
          --ht-icon-button-icon-color: #aeaeae;
          --ht-icon-button-hover-border-color: #ededef;
          --ht-icon-button-hover-background-color: #ededef;
          --ht-icon-button-hover-icon-color: #353535;
          --ht-icon-button-active-border-color: rgba(255, 255, 255, 0);
          --ht-icon-button-active-background-color: rgba(255, 255, 255, 0);
          --ht-icon-button-active-icon-color: #aeaeae;
          --ht-icon-button-active-hover-border-color: #ffffff;
          --ht-icon-button-active-hover-background-color: #232326;
          --ht-icon-button-active-hover-icon-color: #ffffff;
          --ht-collapse-button-border-radius: 16px;
          --ht-collapse-button-open-border-color: rgba(255, 255, 255, 0);
          --ht-collapse-button-open-background-color: #f7f7f9;
          --ht-collapse-button-open-icon-color: #727272;
          --ht-collapse-button-open-icon-active-color: #353535;
          --ht-collapse-button-open-hover-border-color: rgba(255, 255, 255, 0);
          --ht-collapse-button-open-hover-background-color: #ededef;
          --ht-collapse-button-open-hover-icon-color: #353535;
          --ht-collapse-button-open-hover-icon-active-color: #ffffff;
          --ht-collapse-button-close-border-color: rgba(255, 255, 255, 0);
          --ht-collapse-button-close-background-color: #f7f7f9;
          --ht-collapse-button-close-icon-color: #727272;
          --ht-collapse-button-close-icon-active-color: #353535;
          --ht-collapse-button-close-hover-border-color: rgba(255, 255, 255, 0);
          --ht-collapse-button-close-hover-background-color: #ededef;
          --ht-collapse-button-close-hover-icon-color: #353535;
          --ht-collapse-button-close-hover-icon-active-color: #ffffff;
          --ht-button-border-radius: 24px;
          --ht-button-horizontal-padding: 16px;
          --ht-button-vertical-padding: 8px;
          --ht-primary-button-border-color: rgba(255, 255, 255, 0);
          --ht-primary-button-foreground-color: #ffffff;
          --ht-primary-button-background-color: #37bc6c;
          --ht-primary-button-disabled-border-color: rgba(255, 255, 255, 0);
          --ht-primary-button-disabled-foreground-color: #aeaeae;
          --ht-primary-button-disabled-background-color: #dae5df;
          --ht-primary-button-hover-border-color: rgba(255, 255, 255, 0);
          --ht-primary-button-hover-foreground-color: #ffffff;
          --ht-primary-button-hover-background-color: #32a961;
          --ht-primary-button-focus-border-color: #ffffff;
          --ht-primary-button-focus-foreground-color: #ffffff;
          --ht-primary-button-focus-background-color: #37bc6c;
          --ht-secondary-button-border-color: #e7e7e9;
          --ht-secondary-button-foreground-color: #37bc6c;
          --ht-secondary-button-background-color: #ffffff;
          --ht-secondary-button-disabled-border-color: #e7e7e9;
          --ht-secondary-button-disabled-foreground-color: #aeaeae;
          --ht-secondary-button-disabled-background-color: #f7f7f9;
          --ht-secondary-button-hover-border-color: #e7e7e9;
          --ht-secondary-button-hover-foreground-color: #37bc6c;
          --ht-secondary-button-hover-background-color: #ededef;
          --ht-secondary-button-focus-border-color: #e7e7e9;
          --ht-secondary-button-focus-foreground-color: #37bc6c;
          --ht-secondary-button-focus-background-color: #ffffff;
          --ht-comments-textarea-horizontal-padding: 12px;
          --ht-comments-textarea-vertical-padding: 8px;
          --ht-comments-textarea-border-width: 1px;
          --ht-comments-textarea-border-color: rgba(255, 255, 255, 0);
          --ht-comments-textarea-foreground-color: #353535;
          --ht-comments-textarea-background-color: #f7f7f9;
          --ht-comments-textarea-focus-border-width: 1px;
          --ht-comments-textarea-focus-border-color: #37bc6c;
          --ht-comments-textarea-focus-foreground-color: #353535;
          --ht-comments-textarea-focus-background-color: #ffffff;
          --ht-comments-indicator-size: 6px;
          --ht-comments-indicator-color: #37bc6c;
          --ht-license-horizontal-padding: 16px;
          --ht-license-vertical-padding: 8px;
          --ht-license-foreground-color: #353535;
          --ht-license-background-color: #f7f7f9;
          --ht-link-color: #37bc6c;
          --ht-link-hover-color: #32a961;
          --ht-input-border-width: 1px;
          --ht-input-border-radius: 6px;
          --ht-input-horizontal-padding: 16px;
          --ht-input-vertical-padding: 8px;
          --ht-input-border-color: #e7e7e9;
          --ht-input-foreground-color: #353535;
          --ht-input-background-color: #f7f7f9;
          --ht-input-hover-border-color: #e7e7e9;
          --ht-input-hover-foreground-color: #353535;
          --ht-input-hover-background-color: #ffffff;
          --ht-input-disabled-border-color: #e7e7e9;
          --ht-input-disabled-foreground-color: #aeaeae;
          --ht-input-disabled-background-color: #ffffff;
          --ht-input-focus-border-color: #37bc6c;
          --ht-input-focus-foreground-color: #353535;
          --ht-input-focus-background-color: #ffffff;
          --ht-menu-border-width: 0;
          --ht-menu-border-radius: 12px;
          --ht-menu-horizontal-padding: 0;
          --ht-menu-vertical-padding: 12px;
          --ht-menu-item-horizontal-padding: 8px;
          --ht-menu-item-vertical-padding: 8px;
          --ht-menu-border-color: #e7e7e9;
          --ht-menu-shadow-x: 0;
          --ht-menu-shadow-y: 8px;
          --ht-menu-shadow-blur: 16px;
          --ht-menu-shadow-color: rgba(35, 35, 38, 0.06);
          --ht-menu-item-hover-color: rgba(55, 188, 108, 0.08);
          --ht-menu-item-active-color: rgba(55, 188, 108, 0.12);
        }
      `}</style>

      <Paper withBorder p="xl" radius="md">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="md">
            <Title order={4} c="dimmed">
              ACTUAL SHIPPING FEES
            </Title>
            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 200 }} fw={500}>
                Alibaba Shipping Cost
              </Text>
              <NumberInput
                placeholder="Enter amount"
                value={actualAlibabaShipping}
                onChange={setActualAlibabaShipping}
                prefix="₱"
                thousandSeparator=","
                decimalScale={2}
                fixedDecimalScale
                size="md"
                style={{ flex: 1 }}
              />
            </Flex>
            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 200 }} fw={500}>
                Forwarder&apos;s Fee (KPC)
              </Text>
              <NumberInput
                placeholder="Enter amount"
                value={actualForwardersFee}
                onChange={setActualForwardersFee}
                prefix="₱"
                thousandSeparator=","
                decimalScale={2}
                fixedDecimalScale
                size="md"
                style={{ flex: 1 }}
              />
            </Flex>
            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 200 }} fw={500}>
                Lalamove
              </Text>
              <NumberInput
                placeholder="Enter amount"
                value={actualLalamove}
                onChange={setActualLalamove}
                prefix="₱"
                thousandSeparator=","
                decimalScale={2}
                fixedDecimalScale
                size="md"
                style={{ flex: 1 }}
              />
            </Flex>
          </Stack>

          <Stack gap="md" justify="flex-start">
            <Title order={4} c="dimmed">
              SHIPMENT CODE DETAILS
            </Title>
            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 220 }} fw={500}>
                Select Shipment Code
              </Text>
              <Select
                placeholder="Choose a shipment code"
                data={shipmentCodes}
                value={selectedShipmentCode}
                onChange={handleShipmentCodeChange}
                searchable
                clearable
                size="md"
                maxDropdownHeight={400}
                style={{ flex: 1 }}
              />
            </Flex>
          </Stack>
        </SimpleGrid>
      </Paper>

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
          className="ht-theme-horizon htCenter htMiddle"
        />
      </Card>
    </Stack>
  );
}
