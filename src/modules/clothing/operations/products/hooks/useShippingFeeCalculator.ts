'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { showNotification } from '@mantine/notifications';
import type { HotTableClass } from '@handsontable/react';
import type { CellChange, ChangeSource } from 'handsontable/common';
import type { ColumnSettings } from 'handsontable/settings';
import { useShipmentsData } from '../../shipments/hooks/useShipmentsData';
import { useProductsData } from './useProductsData';

const PERSISTED_SHIPMENT_CODE_KEY =
  'shippingFeeCalculator:selectedShipmentCode';

export interface ShippingFeeData {
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

export interface ShippingResultSummaryData {
  totalProducts: number;
  totalActualQuantity: number;
  totalApproxQuantity: number;
  totalAlibabaShipping: number;
  totalForwardersFee: number;
  totalLalamove: number;
  totalPackaging: number;
}

interface ShippingFeeStateResponse {
  shipmentCode: string;
  actualAlibabaShipping: number;
  actualForwardersFee: number;
  actualLalamove: number;
  multipliers: Record<string, number>;
}

export interface ShippingFeeRawRow {
  productCode: string;
  actualQuantity: number | null;
  multiplier: number | null;
}

export interface ShippingActualInputs {
  alibaba: number;
  forwarders: number;
  lalamove: number;
}

const createEmptyRow = (): ShippingFeeData => ({
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

const parseCellNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const normalizeMultipliers = (
  rawMultipliers: Record<string, unknown>
): Record<string, number> => {
  return Object.entries(rawMultipliers).reduce<Record<string, number>>(
    (acc, [key, value]) => {
      const code = key.trim();
      if (!code) {
        return acc;
      }

      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        acc[code] = numericValue;
      }

      return acc;
    },
    {}
  );
};

const buildRawRowsFromHotData = (matrix: unknown[][]): ShippingFeeRawRow[] => {
  return matrix.map((row) => ({
    productCode: typeof row[0] === 'string' ? row[0] : '',
    actualQuantity: parseCellNumber(row[1]),
    multiplier: parseCellNumber(row[2]),
  }));
};

const toActualInputs = (
  alibaba: number | string,
  forwarders: number | string,
  lalamove: number | string
): ShippingActualInputs => {
  const sanitize = (value: number | string): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.replace(/,/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  };

  return {
    alibaba: sanitize(alibaba),
    forwarders: sanitize(forwarders),
    lalamove: sanitize(lalamove),
  };
};

export const calculateShippingRows = (
  rows: ShippingFeeRawRow[],
  inputs: ShippingActualInputs
): ShippingFeeData[] => {
  const enrichedRows = rows.map((row) => {
    const aproxQuantity =
      row.actualQuantity !== null && row.multiplier !== null
        ? row.actualQuantity * row.multiplier
        : null;

    return {
      productCode: row.productCode,
      actualQuantity: row.actualQuantity,
      multiplier: row.multiplier,
      aproxQuantity,
    };
  });

  const totalAproxQuantity = enrichedRows.reduce((sum, row) => {
    return sum + (row.aproxQuantity ?? 0);
  }, 0);

  return enrichedRows.map((row) => {
    const percentage =
      row.aproxQuantity !== null && totalAproxQuantity > 0
        ? row.aproxQuantity / totalAproxQuantity
        : null;

    const calculateCost = (base: number): number | null => {
      if (percentage === null || base <= 0) {
        return null;
      }

      return base * percentage;
    };

    const lalamoveCost = calculateCost(inputs.lalamove);

    return {
      productCode: row.productCode,
      actualQuantity: row.actualQuantity,
      multiplier: row.multiplier,
      aproxQuantity: row.aproxQuantity,
      percentage,
      alibabaShippingCost: calculateCost(inputs.alibaba),
      forwardersFee: calculateCost(inputs.forwarders),
      lalamove: lalamoveCost,
      packaging: lalamoveCost,
    };
  });
};

export const buildResultSummary = (
  rows: ShippingFeeData[]
): ShippingResultSummaryData => {
  return rows.reduce<ShippingResultSummaryData>(
    (acc, row) => ({
      totalProducts: row.productCode
        ? acc.totalProducts + 1
        : acc.totalProducts,
      totalActualQuantity: acc.totalActualQuantity + (row.actualQuantity ?? 0),
      totalApproxQuantity: acc.totalApproxQuantity + (row.aproxQuantity ?? 0),
      totalAlibabaShipping:
        acc.totalAlibabaShipping + (row.alibabaShippingCost ?? 0),
      totalForwardersFee: acc.totalForwardersFee + (row.forwardersFee ?? 0),
      totalLalamove: acc.totalLalamove + (row.lalamove ?? 0),
      totalPackaging: acc.totalPackaging + (row.packaging ?? 0),
    }),
    {
      totalProducts: 0,
      totalActualQuantity: 0,
      totalApproxQuantity: 0,
      totalAlibabaShipping: 0,
      totalForwardersFee: 0,
      totalLalamove: 0,
      totalPackaging: 0,
    }
  );
};

const extractRawRows = (rows: ShippingFeeData[]): ShippingFeeRawRow[] =>
  rows.map((row) => ({
    productCode: row.productCode,
    actualQuantity: row.actualQuantity,
    multiplier: row.multiplier,
  }));

export function useShippingFeeCalculator() {
  const { shipments } = useShipmentsData();
  const { products } = useProductsData();

  const [data, setData] = useState<ShippingFeeData[]>([createEmptyRow()]);
  const [gridHeight, setGridHeight] = useState(600);
  const hotTableRef = useRef<HotTableClass>(null);
  const hasRestoredShipmentCode = useRef(false);

  const [actualAlibabaShipping, setActualAlibabaShipping] = useState<
    number | string
  >('');
  const [actualForwardersFee, setActualForwardersFee] = useState<
    number | string
  >('');
  const [actualLalamove, setActualLalamove] = useState<number | string>('');

  const [selectedShipmentCode, setSelectedShipmentCode] = useState<
    string | null
  >(null);

  const shipmentCodes = useMemo(() => {
    return Array.from(
      new Set(
        shipments
          .filter((shipment) => shipment['Shipment Status'] !== 'Delivered')
          .map((shipment) => shipment['Shipment Code'])
          .filter((code) => code && code.trim() !== '')
      )
    ).sort();
  }, [shipments]);

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

        const normalizedMultipliers = normalizeMultipliers(rawMultipliers);

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

      const actualInputs = toActualInputs(alibaba, forwarders, lalamove);

      try {
        const response = await fetch(
          '/api/clothing/operations/products/shipping-fee-calculator',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shipmentCode,
              actualInputs: {
                actualAlibabaShipping: actualInputs.alibaba,
                actualForwardersFee: actualInputs.forwarders,
                actualLalamove: actualInputs.lalamove,
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setGridHeight(window.innerHeight * 0.7);
  }, []);

  useEffect(() => {
    if (!selectedShipmentCode) {
      setData([createEmptyRow()]);
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
        (product) => product['Shipment Code'] === selectedShipmentCode
      );

      const multipliersMap = savedState?.multipliers || {};

      const newData = filteredProducts.map<ShippingFeeData>((product) => {
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

      setData(newData.length > 0 ? newData : [createEmptyRow()]);
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

  useEffect(() => {
    if (!selectedShipmentCode) {
      return;
    }

    const actualInputs = toActualInputs(
      actualAlibabaShipping,
      actualForwardersFee,
      actualLalamove
    );

    let recalculatedRows: ShippingFeeData[] = [];

    setData((previousRows) => {
      const newRows = calculateShippingRows(
        extractRawRows(previousRows),
        actualInputs
      );
      recalculatedRows = newRows;
      return newRows;
    });

    if (recalculatedRows.length > 0) {
      void saveData(
        recalculatedRows,
        selectedShipmentCode,
        actualAlibabaShipping,
        actualForwardersFee,
        actualLalamove
      );
    }
  }, [
    actualAlibabaShipping,
    actualForwardersFee,
    actualLalamove,
    saveData,
    selectedShipmentCode,
  ]);

  const columns = useMemo<ColumnSettings[]>(
    () => [
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
    ],
    []
  );

  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (!changes || source === 'loadData') {
        return;
      }

      const hot = hotTableRef.current?.hotInstance;
      if (!hot) {
        return;
      }

      const updatedData = hot.getData() as unknown[][];
      const rawRows = buildRawRowsFromHotData(updatedData);
      const actualInputs = toActualInputs(
        actualAlibabaShipping,
        actualForwardersFee,
        actualLalamove
      );
      const newRows = calculateShippingRows(rawRows, actualInputs);

      setData(newRows);

      if (selectedShipmentCode) {
        void saveData(
          newRows,
          selectedShipmentCode,
          actualAlibabaShipping,
          actualForwardersFee,
          actualLalamove
        );
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

  const resultSummary = useMemo(() => buildResultSummary(data), [data]);

  return {
    data,
    gridHeight,
    columns,
    hotTableRef,
    actualAlibabaShipping,
    setActualAlibabaShipping,
    actualForwardersFee,
    setActualForwardersFee,
    actualLalamove,
    setActualLalamove,
    shipmentCodes,
    selectedShipmentCode,
    handleShipmentCodeChange,
    handleAfterChange,
    resultSummary,
  } as const;
}
