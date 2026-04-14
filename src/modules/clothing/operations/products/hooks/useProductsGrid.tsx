'use client';

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { showNotification } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import type { CellChange, ChangeSource } from 'handsontable/common';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';
import { showCustomAlert } from '@/lib/alerts';
import { calculateProductFinancials } from '@/lib/productCalculations';
import { useProductsData } from './useProductsData';
import { useProductForm } from './useProductForm';
import type { ProductData } from '../types/product.types';
import {
  PRODUCT_COLUMN_KEYS,
  clippedTextRenderer,
  createSplitBadgeRenderer,
  displayOptionalNumber,
} from '../lib/gridRenderers';
import { useQuery } from '@tanstack/react-query';
import { buildApiPath } from '@/lib/api/paths';
import type { SplitBatchFromAPI } from '@/modules/clothing/operations/inventory/types';

type LastClick = {
  row: number;
  col: number;
  time: number;
};

const COST_RECALC_TRIGGER_KEYS = new Set<keyof ProductData>([
  'Alibaba Shipping Cost',
  "Forwarder's Fee",
  'Lalamove',
  'Packaging Cost',
]);

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

interface UseProductsGridResult {
  searchQuery: string;
  handleSearch: (query: string) => void;
  isEditMode: boolean;
  toggleEditMode: () => void;
  addProductOpen: boolean;
  openCreateProductModal: () => void;
  closeProductModal: () => void;
  gridHeight: number;
  tableData: Array<(string | number | null)[]>;
  columns: Array<Record<string, unknown>>;
  handleAfterChange: (
    changes: CellChange[] | null,
    source: ChangeSource
  ) => void;
  handleCellClick: (
    event: MouseEvent,
    coords: { row: number; col: number }
  ) => void;
  handleSubmitProduct: () => Promise<void>;
  filteredProducts: ProductData[];
  products: ProductData[];
  statistics: {
    totalValue: number;
    totalProfit: number;
  };
  productForm: ReturnType<typeof useProductForm>;
  isLoading: boolean;
  selectedShipmentCode: string | null;
  selectedProductCode: string | null;
  handleTransitBuildUp: () => Promise<void>;
}

interface UseProductsGridParams {
  apiBasePath?: string;
}

export function useProductsGrid({
  apiBasePath,
}: UseProductsGridParams = {}): UseProductsGridResult {
  const {
    products,
    filteredProducts,
    searchQuery,
    statistics,
    isLoading,
    handleSearch,
    addProduct,
    updateProduct,
    bulkUpdateProducts,
    refreshProducts,
  } = useProductsData(apiBasePath);

  const productForm = useProductForm();

  const { data: splitBatches = [] } = useQuery<SplitBatchFromAPI[]>({
    queryKey: ['split-batches', apiBasePath ?? 'default'],
    queryFn: async () => {
      const response = await fetch(
        buildApiPath(apiBasePath, '/split-batches')
      );
      if (!response.ok) {
        return [];
      }
      return (await response.json()) as SplitBatchFromAPI[];
    },
    staleTime: 30 * 1000,
  });

  const splitChildSkus = useMemo(() => {
    const skus = new Set<string>();
    splitBatches.forEach((batch) => {
      batch.components.forEach((c) => {
        const normalized = c.componentSku.trim().toLowerCase();
        if (normalized) {
          skus.add(normalized);
        }
      });
    });
    return skus;
  }, [splitBatches]);

  const [addProductOpen, setAddProductOpen] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const lastClickRef = useRef<LastClick | null>(null);

  const selectedProduct = useMemo(() => {
    if (selectedRow === null) {
      return null;
    }
    if (selectedRow < 0 || selectedRow >= filteredProducts.length) {
      return null;
    }
    return filteredProducts[selectedRow] ?? null;
  }, [filteredProducts, selectedRow]);

  const selectedShipmentCode = useMemo(() => {
    const raw = selectedProduct?.['Shipment Code'];
    const normalized = (raw ?? '').toString().trim();
    return normalized.length ? normalized : null;
  }, [selectedProduct]);

  const selectedProductCode = useMemo(() => {
    const raw = selectedProduct?.['Product Code'];
    const normalized = (raw ?? '').toString().trim();
    return normalized.length ? normalized : null;
  }, [selectedProduct]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGridHeight(window.innerHeight * 0.8);
    }
  }, []);

  useCtrlFFocus('[data-ctrlf-target="products-search-input"]', !isLoading);

  const tableData = useMemo(
    () =>
      filteredProducts.map((product) => [
        product['Shipment Code'],
        product['CV Number'],
        product['No. Of Sacks'],
        product['Total CBM'],
        product.Weight,
        product['Shipment Status'],
        product['Posting Date'],
        product['Order Date'],
        product.Payment,
        product.Product,
        product['Product Code'],
        product['Age Range'],
        product.Unit,
        product['Unit Price'],
        product.Quantity,
        product['Alibaba Shipping Cost'],
        product['Exchange Rates'],
        product.PHP,
        product['Sub Total (PHP)'],
        product['Transaction Fee'],
        product['Grand Total'],
        product["Forwarder's Fee"],
        product.Lalamove,
        product['Packaging Cost'],
        product['Suggested Price'],
        product['Actual Price'],
        product['Landed Unit Cost'],
        product.COGS,
        product['Projected Sales'],
        product['Projected Profit'],
        product['Projected Profit (%)'],
        product['Total Markup'],
        product['Link To Post'] || '',
        displayOptionalNumber(product['Bulk Quantity']),
        displayOptionalNumber(product['Bulk Weight']),
        displayOptionalNumber(product['Weight Per Piece']),
      ]),
    [filteredProducts]
  );

  const columns = useMemo(
    () => [
      {
        data: 0,
        title: 'SHIPMENT CODE',
        width: 180,
        type: 'text',
        readOnly: !isEditMode,
      },
      { data: 1, title: 'CV NUMBER', width: 180, type: 'text', readOnly: true },
      {
        data: 2,
        title: 'NO. OF SACKS',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0' },
        readOnly: true,
      },
      {
        data: 3,
        title: 'TOTAL CBM',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 4,
        title: 'WEIGHT',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0' },
        readOnly: true,
      },
      {
        data: 5,
        title: 'SHIPMENT STATUS',
        width: 180,
        type: 'text',
        readOnly: true,
      },
      {
        data: 6,
        title: 'POSTING DATE',
        width: 180,
        type: 'text',
        readOnly: true,
      },
      {
        data: 7,
        title: 'ORDER DATE',
        width: 180,
        type: 'text',
        readOnly: true,
      },
      { data: 8, title: 'PAYMENT', width: 180, type: 'text', readOnly: true },
      {
        data: 9,
        title: 'PRODUCT',
        width: 500,
        type: 'text',
        readOnly: !isEditMode,
        className: 'htLeft',
      },
      {
        data: 10,
        title: 'PRODUCT CODE',
        width: 500,
        type: 'text',
        readOnly: true,
        className: 'htLeft',
        renderer: createSplitBadgeRenderer(splitChildSkus),
      },
      {
        data: 11,
        title: 'AGE RANGE',
        width: 180,
        type: 'text',
        readOnly: true,
      },
      { data: 12, title: 'UNIT', width: 180, type: 'text', readOnly: true },
      {
        data: 13,
        title: 'UNIT PRICE',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 14,
        title: 'QUANTITY',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0' },
        readOnly: true,
      },
      {
        data: 15,
        title: 'ALIBABA SHIPPING',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: !isEditMode,
      },
      {
        data: 16,
        title: 'EXCHANGE RATE',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 17,
        title: 'PHP',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 18,
        title: 'SUB TOTAL (PHP)',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 19,
        title: 'TRANSACTION FEE',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 20,
        title: 'GRAND TOTAL',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 21,
        title: "FORWARDER'S FEE",
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: !isEditMode,
      },
      {
        data: 22,
        title: 'LALAMOVE',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: !isEditMode,
      },
      {
        data: 23,
        title: 'PACKAGING COST',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: !isEditMode,
      },
      {
        data: 24,
        title: 'SUGGESTED PRICE',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 25,
        title: 'ACTUAL PRICE',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 26,
        title: 'LANDED UNIT COST',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 27,
        title: 'COGS',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 28,
        title: 'PROJECTED SALES',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 29,
        title: 'PROJECTED PROFIT',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 30,
        title: 'PROFIT MARGIN (%)',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 31,
        title: 'TOTAL MARKUP (%)',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 32,
        title: 'LINK TO POST',
        width: 220,
        type: 'text',
        readOnly: true,
        className: 'htLeft',
        renderer: clippedTextRenderer,
        wordWrap: false,
      },
      {
        data: 33,
        title: 'BULK QUANTITY',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0' },
        readOnly: true,
      },
      {
        data: 34,
        title: 'BULK WEIGHT',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
      {
        data: 35,
        title: 'WEIGHT PER PIECE',
        width: 180,
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: true,
      },
    ],
    [isEditMode, splitChildSkus]
  );

  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (!changes || source === 'loadData') {
        return;
      }

      const updatedProducts = [...products];
      const recalcGlobalIndexes = new Set<number>();

      changes.forEach(([row, col, _oldValue, newValue]) => {
        if (row < filteredProducts.length) {
          const product = filteredProducts[row];
          const globalIndex = products.findIndex((p) => p.id === product.id);

          if (globalIndex !== -1) {
            const key = PRODUCT_COLUMN_KEYS[col as number];
            if (!key) {
              return;
            }

            if (col === 0 && (!newValue || newValue === '')) {
              updatedProducts[globalIndex] = {
                ...updatedProducts[globalIndex],
                'Shipment Code': '',
                'CV Number': '',
                'No. Of Sacks': 0,
                'Total CBM': 0,
                Weight: 0,
                'Shipment Status': '',
              } as ProductData;
            } else {
              updatedProducts[globalIndex] = {
                ...updatedProducts[globalIndex],
                [key]: newValue as ProductData[keyof ProductData],
              };

              if (COST_RECALC_TRIGGER_KEYS.has(key)) {
                recalcGlobalIndexes.add(globalIndex);
              }
            }
          }
        }
      });

      recalcGlobalIndexes.forEach((index) => {
        const current = updatedProducts[index];
        if (!current) {
          return;
        }

        const calculations = calculateProductFinancials({
          unitPrice: toSafeNumber(current['Unit Price']),
          quantity: toSafeNumber(current.Quantity),
          alibabaShippingCost: toSafeNumber(current['Alibaba Shipping Cost']),
          exchangeRates: toSafeNumber(current['Exchange Rates']),
          forwardersFee: toSafeNumber(current["Forwarder's Fee"]),
          lalamove: toSafeNumber(current.Lalamove),
          packagingCost: toSafeNumber(current['Packaging Cost']),
          actualPrice: toSafeNumber(current['Actual Price']),
          // Preserve prior toggle behavior: if fee is zero, keep fee off.
          applyTransactionFee: toSafeNumber(current['Transaction Fee']) > 0,
          bulkQuantity: toSafeNumber(current['Bulk Quantity']),
          bulkWeight: toSafeNumber(current['Bulk Weight']),
        });

        updatedProducts[index] = {
          ...current,
          PHP: calculations.php,
          'Sub Total (PHP)': calculations.subTotalPHP,
          'Transaction Fee': calculations.transactionFee,
          'Grand Total': calculations.grandTotal,
          'Suggested Price': calculations.suggestedPrice,
          'Landed Unit Cost': calculations.basePrice,
          COGS: calculations.cogs,
          'Projected Sales': calculations.projectedSales,
          'Projected Profit': calculations.projectedProfit,
          'Projected Profit (%)': calculations.projectedProfitPercent,
          'Total Markup': calculations.totalMarkup,
          'Weight Per Piece': calculations.weightPerPiece,
        };
      });

      bulkUpdateProducts(updatedProducts);
    },
    [products, filteredProducts, bulkUpdateProducts]
  );

  const handleCellClick = useCallback(
    (event: MouseEvent, coords: { row: number; col: number }) => {
      if (coords.row >= 0 && coords.row < filteredProducts.length) {
        setSelectedRow(coords.row);
      }

      const now = Date.now();
      const lastClick = lastClickRef.current;

      const isDoubleClick =
        lastClick &&
        lastClick.row === coords.row &&
        lastClick.col === coords.col &&
        now - lastClick.time < 300;

      if (isDoubleClick) {
        if (
          coords.col === 10 &&
          coords.row >= 0 &&
          coords.row < filteredProducts.length
        ) {
          const product = filteredProducts[coords.row];
          productForm.populateForm(product);
          setAddProductOpen(true);
        }

        lastClickRef.current = null;
      } else {
        lastClickRef.current = {
          row: coords.row,
          col: coords.col,
          time: now,
        };
      }
    },
    [filteredProducts, productForm]
  );

  const handleTransitBuildUp = useCallback(async () => {
    if (!selectedShipmentCode) {
      showNotification({
        title: 'Select a Shipment Code',
        message: 'Click a product row with a Shipment Code first.',
        color: 'red',
      });
      return;
    }

    const normalizeShipmentCode = (value: unknown) =>
      (value ?? '').toString().trim().toLowerCase();

    const shipmentProducts = products.filter(
      (p) =>
        normalizeShipmentCode(p['Shipment Code']) ===
        normalizeShipmentCode(selectedShipmentCode)
    );

    if (shipmentProducts.length === 0) {
      showNotification({
        title: 'No Products Found',
        message: `No products are linked to shipment ${selectedShipmentCode}.`,
        color: 'red',
      });
      return;
    }

    const toAmount = (value: unknown) => Number(value ?? 0);
    const formatPhp = (amount: number) =>
      new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);

    const escapeHtml = (value: unknown) => {
      const input = (value ?? '').toString();
      return input.replace(/[&<>'"]/g, (character) => {
        switch (character) {
          case '&':
            return '&amp;';
          case '<':
            return '&lt;';
          case '>':
            return '&gt;';
          case "'":
            return '&#39;';
          case '"':
            return '&quot;';
          default:
            return character;
        }
      });
    };

    const rowsHtml = shipmentProducts
      .map((product) => {
        const grandTotal = toAmount(product['Grand Total']);
        const forwardersFee = toAmount(product["Forwarder's Fee"]);
        const lalamove = toAmount(product.Lalamove);
        const packaging = toAmount(product['Packaging Cost']);
        const sum = grandTotal + forwardersFee + lalamove;
        const postingDate =
          (product['Posting Date'] ?? '').toString().trim() ||
          (product['Order Date'] ?? '').toString().trim() ||
          '—';

        const tdBaseStyle =
          'padding: 6px 8px; border-top: 1px solid #dee2e6; vertical-align: top;';
        const tdLeftNoWrapStyle = `${tdBaseStyle} text-align: left; white-space: nowrap;`;
        const tdRightNoWrapStyle = `${tdBaseStyle} text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;`;

        return `
          <tr>
            <td style="${tdLeftNoWrapStyle} min-width: 240px;">${escapeHtml(product['Product Code'] || '—')}</td>
            <td style="${tdLeftNoWrapStyle}">${escapeHtml(product.Payment || '—')}</td>
            <td style="${tdLeftNoWrapStyle}">${escapeHtml(postingDate)}</td>
            <td style="${tdRightNoWrapStyle}">${escapeHtml(formatPhp(grandTotal))}</td>
            <td style="${tdRightNoWrapStyle}">${escapeHtml(formatPhp(forwardersFee))}</td>
            <td style="${tdRightNoWrapStyle}">${escapeHtml(formatPhp(lalamove))}</td>
            <td style="${tdRightNoWrapStyle}">${escapeHtml(formatPhp(sum))}</td>
            <td style="${tdRightNoWrapStyle}">${escapeHtml(formatPhp(packaging))}</td>
          </tr>
        `;
      })
      .join('');

    const detailHtml = `
      <div style="text-align: left;">
        <div style="max-height: 360px; overflow: auto; border: 1px solid #dee2e6; border-radius: 8px;">
          <table style="min-width: 980px; width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="text-align: left; background: #f8f9fa;">
                <th style="padding: 8px;">Product Code</th>
                <th style="padding: 8px;">Payment</th>
                <th style="padding: 8px;">Posting Date</th>
                <th style="padding: 8px; text-align: right;">Grand Total</th>
                <th style="padding: 8px; text-align: right;">Forwarder's Fee</th>
                <th style="padding: 8px; text-align: right;">Lalamove</th>
                <th style="padding: 8px; text-align: right;">Total</th>
                <th style="padding: 8px; text-align: right;">Packaging (excluded)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <p style="margin: 12px 0 0; font-size: 13px; color: #495057;">
          <small>
            Already-posted products may be skipped (idempotent). Products with missing payment/date or before cutover will not be posted.
          </small>
        </p>
      </div>
    `;

    const modalResult = await showCustomAlert({
      title: `Post Transit Build-Up • ${selectedShipmentCode}`,
      html: detailHtml,
      icon: 'question',
      width: '54vw',
      showCancelButton: true,
      confirmButtonText: 'Post Transit Build-Up',
      cancelButtonText: 'Cancel',
      focusCancel: true,
    });

    const shouldConfirm = modalResult.isConfirmed;

    if (!shouldConfirm) {
      return;
    }

    const { ProductService } = await import('../services/ProductService');
    const result = await ProductService.postTransitBuildUpByShipmentCode(
      selectedShipmentCode,
      apiBasePath
    );

    if (result.success) {
      showNotification({
        title: '✅ Transit Build-Up Posted',
        message: `Created ${result.data.created} entries (skipped ${result.data.skipped}) across ${result.data.products} products.`,
        color: 'green',
        icon: createElement(IconCheck, { size: 18 }),
      });
      await refreshProducts();
      return;
    }

    showNotification({
      title: '❌ Transit Build-Up Failed',
      message: result.error,
      color: 'red',
    });
  }, [apiBasePath, products, refreshProducts, selectedShipmentCode]);

  const handleSubmitProduct = useCallback(async () => {
    const validation = productForm.validate();
    if (!validation.isValid) {
      showNotification({
        title: 'Validation Error',
        message: validation.errors[0],
        color: 'red',
      });
      return;
    }

    const existingProduct = productForm.isEditMode
      ? products.find((p) => p.id === productForm.editingProductId)
      : undefined;

    const productData = productForm.toProductData(existingProduct);

    // Prevent saving duplicate product codes
    const normalizedCode = productData['Product Code']
      ?.toString()
      .trim()
      .toLowerCase();

    const duplicate = products.some(
      (p) =>
        p['Product Code']?.toString().trim().toLowerCase() === normalizedCode &&
        (!productForm.isEditMode || p.id !== productForm.editingProductId)
    );

    if (normalizedCode && duplicate) {
      showNotification({
        title: 'Duplicate Product Code',
        message: `${productData['Product Code']} already exists. Adjust the product name or posting date to generate a unique code.`,
        color: 'red',
      });
      return;
    }

    if (productForm.isEditMode && productForm.editingProductId) {
      const result = await updateProduct(
        productForm.editingProductId,
        productData
      );
      if (result.success) {
        showNotification({
          title: '✅ Product Updated Successfully!',
          message: `${productForm.form.product} has been updated`,
          color: 'green',
          icon: createElement(IconCheck, { size: 18 }),
        });
        productForm.resetForm();
        setAddProductOpen(false);
      } else {
        showNotification({
          title: '❌ Failed to Update Product',
          message: result.error || 'An error occurred',
          color: 'red',
        });
      }
    } else {
      const result = await addProduct(productData);
      if (result.success) {
        showNotification({
          title: '🎉 Product Added Successfully!',
          message: `${productForm.form.product} has been added`,
          color: 'green',
          icon: createElement(IconCheck, { size: 18 }),
        });
        productForm.resetForm();
        setAddProductOpen(false);
      } else {
        showNotification({
          title: '❌ Failed to Add Product',
          message: result.error || 'An error occurred',
          color: 'red',
        });
      }
    }
  }, [productForm, products, updateProduct, addProduct]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev);
  }, []);

  const openCreateProductModal = useCallback(() => {
    productForm.resetForm();
    setAddProductOpen(true);
  }, [productForm]);

  const closeProductModal = useCallback(() => {
    productForm.resetForm();
    setAddProductOpen(false);
  }, [productForm]);

  return {
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
    isLoading,
    selectedShipmentCode,
    selectedProductCode,
    handleTransitBuildUp,
  };
}
