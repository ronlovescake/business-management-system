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
import { useProductsData } from './useProductsData';
import { useProductForm } from './useProductForm';
import type { ProductData } from '../types/product.types';
import {
  PRODUCT_COLUMN_KEYS,
  clippedTextRenderer,
  displayOptionalNumber,
} from '../lib/gridRenderers';

type LastClick = {
  row: number;
  col: number;
  time: number;
};

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
}

export function useProductsGrid(): UseProductsGridResult {
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
  } = useProductsData();

  const productForm = useProductForm();

  const [addProductOpen, setAddProductOpen] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);
  const [isEditMode, setIsEditMode] = useState(false);
  const lastClickRef = useRef<LastClick | null>(null);

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
        product['Base Price'],
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
        title: 'BASE PRICE',
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
    [isEditMode]
  );

  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (!changes || source === 'loadData') {
        return;
      }

      const updatedProducts = [...products];

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
            }
          }
        }
      });

      bulkUpdateProducts(updatedProducts);
    },
    [products, filteredProducts, bulkUpdateProducts]
  );

  const handleCellClick = useCallback(
    (event: MouseEvent, coords: { row: number; col: number }) => {
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
  };
}
