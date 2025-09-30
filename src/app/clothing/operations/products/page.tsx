'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { GridCellKind, GridColumn, Item } from '@glideapps/glide-data-grid';
import { Stack, Text, Box, Button, Group, FileInput, Loader, TextInput, Card, SimpleGrid, ThemeIcon, Title, Modal, Select, NumberInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconSearch, IconCurrencyDollar, IconFilter, IconTrendingUp, IconTrendingDown, IconPlus, IconUser, IconMail, IconMapPin, IconCheck, IconAdjustments, IconPackage, IconCalendar, IconCreditCard, IconPercentage } from '@tabler/icons-react';

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
  
  /* Make product code column look clickable */
  .data-grid-container canvas {
    cursor: default;
  }
  .data-grid-container:hover canvas {
    cursor: pointer;
  }
`;

// Dynamically import DataEditor to avoid SSR issues
const DataEditor = dynamic(
  () => import('@glideapps/glide-data-grid').then((mod) => mod.DataEditor),
  { ssr: false }
);

interface ProductData {
  id?: number;
  'Shipment Code': string;
  'CV Number': string;
  'No. Of Sacks': number;
  'Total CBM': number;
  'Weight': number;
  'Shipment Status': string;
  'Posting Date': string;
  'Order Date': string;
  'Payment': string;
  'Product': string;
  'Product Code': string;
  'Age Range': string;
  'Unit': string;
  'Unit Price': number;
  'Quantity': number;
  'Alibaba Shipping Cost': number;
  'Exchange Rates': number;
  'PHP': number;
  'Sub Total (PHP)': number;
  'Transaction Fee': number;
  'Grand Total': number;
  'Forwarder\'s Fee': number;
  'Lalamove': number;
  'Packaging Cost': number;
  'Suggested Price': number;
  'Actual Price': number;
  'Base Price': number;
  'COGS': number;
  'Projected Sales': number;
  'Projected Profit': number;
  'Projected Profit (%)': number;
  'Total Markup': number;
}

export default function Products() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductData[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridHeight, setGridHeight] = useState<number>(600);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [newProductForm, setNewProductForm] = useState(() => ({
    shipmentCode: '',
    postingDate: '',
    orderDate: '',
    payment: '',
    product: '',
    ageRange: '',
    unit: '',
    unitPrice: 0,
    quantity: 0,
    alibabaShippingCost: 0,
    exchangeRates: 1,
    forwardersFee: 0,
    lalamove: 0,
    packagingCost: 0,
    actualPrice: 0,
  }));

  // Define columns with all the headers you specified
  const columns: GridColumn[] = [
    { title: 'Shipment Code', width: 150, id: 'shipmentCode', themeOverride: { cellHorizontalPadding: 8 } },
    { title: 'CV Number', width: 120, id: 'cvNumber' },
    { title: 'No. Of Sacks', width: 120, id: 'noOfSacks' },
    { title: 'Total CBM', width: 120, id: 'totalCBM' },
    { title: 'Weight', width: 100, id: 'weight' },
    { title: 'Shipment Status', width: 150, id: 'shipmentStatus' },
    { title: 'Posting Date', width: 130, id: 'postingDate' },
    { title: 'Order Date', width: 130, id: 'orderDate' },
    { title: 'Payment', width: 120, id: 'payment' },
    { title: 'Product', width: 200, id: 'product', themeOverride: { cellHorizontalPadding: 8 } },
    { title: 'Product Code', width: 150, id: 'productCode', themeOverride: { cellHorizontalPadding: 8 } },
    { title: 'Age Range', width: 120, id: 'ageRange' },
    { title: 'Unit', width: 100, id: 'unit' },
    { title: 'Unit Price', width: 120, id: 'unitPrice' },
    { title: 'Quantity', width: 100, id: 'quantity' },
    { title: 'Alibaba Shipping Cost', width: 130, id: 'alibabaShippingCost' },
    { title: 'Exchange Rates', width: 140, id: 'exchangeRates' },
    { title: 'PHP', width: 100, id: 'php' },
    { title: 'Sub Total (PHP)', width: 150, id: 'subTotalPHP' },
    { title: 'Transaction Fee', width: 140, id: 'transactionFee' },
    { title: 'Grand Total', width: 130, id: 'grandTotal' },
    { title: 'Forwarder\'s Fee', width: 130, id: 'forwardersFee' },
    { title: 'Lalamove', width: 130, id: 'lalamove' },
    { title: 'Packaging Cost', width: 120, id: 'packagingCost' },
    { title: 'Suggested Price', width: 150, id: 'suggestedPrice' },
    { title: 'Actual Price', width: 130, id: 'actualPrice' },
    { title: 'Base Price', width: 120, id: 'basePrice' },
    { title: 'COGS', width: 100, id: 'cogs' },
    { title: 'Projected Sales', width: 150, id: 'projectedSales' },
    { title: 'Projected Profit', width: 150, id: 'projectedProfit' },
    { title: 'Projected Profit (%)', width: 170, id: 'projectedProfitPercent' },
    { title: 'Total Markup', width: 130, id: 'totalMarkup' },
  ];

  // Map column ids to ProductData keys
  const idToKey: Record<string, keyof ProductData> = useMemo(() => ({
    shipmentCode: 'Shipment Code',
    cvNumber: 'CV Number',
    noOfSacks: 'No. Of Sacks',
    totalCBM: 'Total CBM',
    weight: 'Weight',
    shipmentStatus: 'Shipment Status',
    postingDate: 'Posting Date',
    orderDate: 'Order Date',
    payment: 'Payment',
    product: 'Product',
    productCode: 'Product Code',
    ageRange: 'Age Range',
    unit: 'Unit',
    unitPrice: 'Unit Price',
    quantity: 'Quantity',
    alibabaShippingCost: 'Alibaba Shipping Cost',
    exchangeRates: 'Exchange Rates',
    php: 'PHP',
    subTotalPHP: 'Sub Total (PHP)',
    transactionFee: 'Transaction Fee',
    grandTotal: 'Grand Total',
    forwardersFee: 'Forwarder\'s Fee',
    lalamove: 'Lalamove',
    packagingCost: 'Packaging Cost',
    suggestedPrice: 'Suggested Price',
    actualPrice: 'Actual Price',
    basePrice: 'Base Price',
    cogs: 'COGS',
    projectedSales: 'Projected Sales',
    projectedProfit: 'Projected Profit',
    projectedProfitPercent: 'Projected Profit (%)',
    totalMarkup: 'Total Markup',
  }), []);

  // Form update handler with useCallback to prevent re-renders
  const updateFormField = useCallback((field: string, value: any) => {
    setNewProductForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Generate Product Code based on Product name and Posting Date
  const generateProductCode = useCallback((productName: string, postingDate: string) => {
    if (!productName.trim()) return '';
    
    // Function to generate initials from product name
    const generateInitials = (name: string) => {
      // Split by spaces, slashes, hyphens, and other separators
      const words = name.split(/[\s\/\-\&\+\(\)]+/).filter(word => word.length > 0);
      
      let initials = '';
      for (const word of words) {
        // Skip common short words and get first letter of meaningful words
        if (word.length > 0 && !['and', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with'].includes(word.toLowerCase())) {
          initials += word.charAt(0).toUpperCase();
        }
      }
      
      // Handle special cases for numbers and common abbreviations
      if (name.includes('2-PC') || name.includes('2PC')) initials = initials.replace(/PC/g, '') + '2S';
      if (name.includes('3-PC') || name.includes('3PC')) initials = initials.replace(/PC/g, '') + '3S';
      if (name.includes('4-PC') || name.includes('4PC')) initials = initials.replace(/PC/g, '') + '4S';
      
      return initials || productName.charAt(0).toUpperCase();
    };
    
    const initials = generateInitials(productName);
    return `${productName} (${initials}-${postingDate})`;
  }, []);

  // Reset form handler
  const resetForm = useCallback(() => {
    setNewProductForm({
      shipmentCode: '',
      postingDate: '',
      orderDate: '',
      payment: '',
      product: '',
      ageRange: '',
      unit: '',
      unitPrice: 0,
      quantity: 0,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
    });
  }, []);

  // Function to calculate optimal column width based on content
  const calculateColumnWidth = useCallback((columnId: string, data: ProductData[]): number => {
    const autoResizeColumns = ['shipmentCode', 'product', 'productCode'];
    if (!autoResizeColumns.includes(columnId)) {
      const col = columns.find(col => col.id === columnId);
      return (col as any)?.width || 150;
    }

    const columnKey = idToKey[columnId];
    if (!columnKey) return 150;

    // Calculate the maximum content width for this column
    let maxWidth = 0;
    let longestText = '';
    
    // Check header width
    const headerText = columns.find(col => col.id === columnId)?.title || '';
    maxWidth = Math.max(maxWidth, headerText.length * 16 + 60);
    longestText = headerText;

    // Check content width - scan all data to find the longest text
    data.forEach(row => {
      const cellValue = String(row[columnKey] || '');
      if (cellValue.length > longestText.length) {
        longestText = cellValue;
      }
      // Use even more generous character width calculation - accounting for variable character widths
      const textWidth = cellValue.length * 16 + 60; // ~16px per character + more padding for safety
      maxWidth = Math.max(maxWidth, textWidth);
    });

    // Set minimum and maximum bounds with very generous limits for Product Code
    const minWidth = columnId === 'productCode' ? 250 : 150; // Even higher minimum for Product Code
    const maxBound = columnId === 'product' ? 500 : columnId === 'shipmentCode' ? 300 : 500; // Much higher max for Product Code (500px)
    
    const calculatedWidth = Math.min(Math.max(maxWidth, minWidth), maxBound);
    
    // Debug log for Product Code column
    if (columnId === 'productCode') {
      console.log(`Product Code column - Longest text: "${longestText}", Calculated width: ${calculatedWidth}`);
    }
    
    return calculatedWidth;
  }, [columns, idToKey]);

  // Auto-resize columns based on content
  const columnsWithAutoSize = useMemo(() => {
    return columns.map(col => {
      const autoResizeColumns = ['shipmentCode', 'product', 'productCode'];
      if (autoResizeColumns.includes(col.id || '')) {
        return {
          ...col,
          width: calculateColumnWidth(col.id || '', filteredProducts)
        };
      }
      return col;
    });
  }, [columns, calculateColumnWidth, filteredProducts]);

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredProducts(products);
      return;
    }

    const filtered = products.filter(product => {
      const searchTerm = query.toLowerCase();
      return (
        product['Shipment Code'].toLowerCase().includes(searchTerm) ||
        product['CV Number'].toLowerCase().includes(searchTerm) ||
        product['Product'].toLowerCase().includes(searchTerm) ||
        product['Product Code'].toLowerCase().includes(searchTerm) ||
        product['Shipment Status'].toLowerCase().includes(searchTerm)
      );
    });

    
    setFilteredProducts(filtered);
  }, [products]);  // Stats calculations
  const stats = useMemo(() => {
    const total = filteredProducts.length;
    const totalValue = filteredProducts.reduce((sum, product) => sum + (product['Grand Total'] || 0), 0);
    const avgValue = total > 0 ? totalValue / total : 0;
    const totalProfit = filteredProducts.reduce((sum, product) => sum + (product['Projected Profit'] || 0), 0);

    return {
      total,
      totalValue,
      avgValue,
      totalProfit,
    };
  }, [filteredProducts]);

  // Load products from database on component mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const productsData = await response.json();
          
          // Convert database format back to ProductData format
          const convertedProducts = productsData.map((product: any, index: number) => {
            const productName = product.product || '';
            const postingDate = product.postingDate || '';
            const existingProductCode = product.productCode || '';
            
            // Generate Product Code if it doesn't exist and we have both product name and posting date
            const generatedProductCode = (!existingProductCode && productName && postingDate) 
              ? generateProductCode(productName, postingDate)
              : existingProductCode;

            return {
              id: product.id,
              'Shipment Code': product.shipmentCode || '',
              'CV Number': product.cvNumber || '',
              'No. Of Sacks': product.noOfSacks || 0,
              'Total CBM': product.totalCBM || 0,
              'Weight': product.weight || 0,
              'Shipment Status': product.shipmentStatus || '',
              'Posting Date': postingDate,
              'Order Date': product.orderDate || '',
              'Payment': product.payment || '',
              'Product': productName,
              'Product Code': generatedProductCode,
              'Age Range': product.ageRange || '',
              'Unit': product.unit || '',
              'Unit Price': product.unitPrice || 0,
              'Quantity': product.quantity || 0,
              'Alibaba Shipping Cost': product.alibabaShippingCost || 0,
              'Exchange Rates': product.exchangeRates || 0,
              'PHP': (product.unitPrice || 0) * (product.exchangeRates || 0), // PHP = Unit Price × Exchange Rate
              'Sub Total (PHP)': ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0), // Sub Total (PHP) = (Unit Price × Quantity + Alibaba Shipping Cost) × Exchange Rate
              'Transaction Fee': ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299, // Transaction Fee = Sub Total (PHP) × 2.99%
              'Grand Total': ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299, // Grand Total = Sub Total (PHP) + Transaction Fee
              'Forwarder\'s Fee': product.forwardersFee || 0,
              'Lalamove': product.lalamove || 0,
              'Packaging Cost': product.packagingCost || 0,
              'Suggested Price': Math.ceil(((product.quantity || 0) > 0 ? (((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299 + (product.forwardersFee || 0) + (product.lalamove || 0) + (product.packagingCost || 0)) / (product.quantity || 1) : 0) * 1.22), // Suggested Price = ROUNDUP(Base Price * 122%)
              'Actual Price': product.actualPrice || 0,
              'Base Price': (product.quantity || 0) > 0 ? (((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299 + (product.forwardersFee || 0) + (product.lalamove || 0) + (product.packagingCost || 0)) / (product.quantity || 1) : 0, // Base Price = COGS / Quantity
              'COGS': ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299 + (product.forwardersFee || 0) + (product.lalamove || 0) + (product.packagingCost || 0), // COGS = Grand Total + Forwarder's Fee + Lalamove + Packaging Cost
              'Projected Sales': (product.actualPrice || 0) * (product.quantity || 0), // Projected Sales Total = Actual Price × Quantity
              'Projected Profit': ((product.actualPrice || 0) * (product.quantity || 0)) - (((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299 + (product.forwardersFee || 0) + (product.lalamove || 0) + (product.packagingCost || 0)), // Projected Profit = Projected Sales Total - COGS
              'Projected Profit (%)': (((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299 + (product.forwardersFee || 0) + (product.lalamove || 0) + (product.packagingCost || 0)) > 0 ? ((((product.actualPrice || 0) * (product.quantity || 0)) - (((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299 + (product.forwardersFee || 0) + (product.lalamove || 0) + (product.packagingCost || 0))) / (((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) + ((product.unitPrice || 0) * (product.quantity || 0) + (product.alibabaShippingCost || 0)) * (product.exchangeRates || 0) * 0.0299 + (product.forwardersFee || 0) + (product.lalamove || 0) + (product.packagingCost || 0))) * 100 : 0, // Projected Profit (%) = (Projected Profit / COGS) * 100
              'Total Markup': ((product.unitPrice || 0) * (product.exchangeRates || 0)) > 0 ? ((product.actualPrice || 0) / ((product.unitPrice || 0) * (product.exchangeRates || 0))) * 100 : 0, // Total Markup = (Actual Price / PHP) * 100
            };
          });

          setProducts(convertedProducts);
          setFilteredProducts(convertedProducts);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };

    loadProducts();
  }, []);

  // CSV Import handler
  const handleCSVImport = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const header = lines[0].split(',');
      
      const importedProducts: ProductData[] = [];
      let id = 1;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        // Parse CSV line (handle quoted values)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"' && (j === 0 || line[j-1] === ',')) {
            inQuotes = true;
          } else if (char === '"' && inQuotes && (j === line.length - 1 || line[j+1] === ',')) {
            inQuotes = false;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        // Ensure we have at least 32 columns by padding with empty strings
        while (values.length < 32) {
          values.push('');
        }

        // Parse numeric values and clean them
        const parseNumeric = (value: string): number => {
          if (!value || value === '') return 0;
          const cleaned = value.replace(/[,"]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        };

        const productData: ProductData = {
          id: id++,
          'Shipment Code': values[0] || '',
          'CV Number': values[1] || '',
          'No. Of Sacks': parseNumeric(values[2]),
          'Total CBM': parseNumeric(values[3]),
          'Weight': parseNumeric(values[4]),
          'Shipment Status': values[5] || '',
          'Posting Date': values[6] || '',
          'Order Date': values[7] || '',
          'Payment': values[8] || '',
          'Product': values[9] || '',
          'Product Code': values[10] || generateProductCode(values[9] || '', values[6] || ''),
          'Age Range': values[11] || '',
          'Unit': values[12] || '',
          'Unit Price': parseNumeric(values[13]),
          'Quantity': parseNumeric(values[14]),
          'Alibaba Shipping Cost': parseNumeric(values[15]),
          'Exchange Rates': parseNumeric(values[16]),
          'PHP': parseNumeric(values[13]) * parseNumeric(values[16]), // PHP = Unit Price × Exchange Rate
          'Sub Total (PHP)': (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]), // Sub Total (PHP) = (Unit Price × Quantity + Shipping Fee 1) × Exchange Rate
          'Transaction Fee': (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299, // Transaction Fee = Sub Total (PHP) × 2.99%
          'Grand Total': (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299, // Grand Total = Sub Total (PHP) + Transaction Fee
          'Forwarder\'s Fee': parseNumeric(values[21]),
          'Lalamove': parseNumeric(values[22]),
          'Packaging Cost': parseNumeric(values[23]),
          'Suggested Price': Math.ceil((parseNumeric(values[14]) > 0 ? ((parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299 + parseNumeric(values[21]) + parseNumeric(values[22]) + parseNumeric(values[23])) / parseNumeric(values[14]) : 0) * 1.22), // Suggested Price = ROUNDUP(Base Price * 122%)
          'Actual Price': parseNumeric(values[25]),
          'Base Price': parseNumeric(values[14]) > 0 ? ((parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299 + parseNumeric(values[21]) + parseNumeric(values[22]) + parseNumeric(values[23])) / parseNumeric(values[14]) : 0, // Base Price = COGS / Quantity
          'COGS': (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299 + parseNumeric(values[21]) + parseNumeric(values[22]) + parseNumeric(values[23]), // COGS = Grand Total + Forwarder's Fee + Lalamove + Packaging Cost
          'Projected Sales': parseNumeric(values[25]) * parseNumeric(values[14]), // Projected Sales Total = Actual Price × Quantity
          'Projected Profit': (parseNumeric(values[25]) * parseNumeric(values[14])) - ((parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299 + parseNumeric(values[21]) + parseNumeric(values[22]) + parseNumeric(values[23])), // Projected Profit = Projected Sales Total - COGS
          'Projected Profit (%)': ((parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299 + parseNumeric(values[21]) + parseNumeric(values[22]) + parseNumeric(values[23])) > 0 ? (((parseNumeric(values[25]) * parseNumeric(values[14])) - ((parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299 + parseNumeric(values[21]) + parseNumeric(values[22]) + parseNumeric(values[23]))) / ((parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) + (parseNumeric(values[13]) * parseNumeric(values[14]) + parseNumeric(values[15])) * parseNumeric(values[16]) * 0.0299 + parseNumeric(values[21]) + parseNumeric(values[22]) + parseNumeric(values[23]))) * 100 : 0, // Projected Profit (%) = (Projected Profit / COGS) * 100
          'Total Markup': (parseNumeric(values[13]) * parseNumeric(values[16])) > 0 ? (parseNumeric(values[25]) / (parseNumeric(values[13]) * parseNumeric(values[16]))) * 100 : 0, // Total Markup = (Actual Price / PHP) * 100
        };

        // Only add if we have essential data
        if (productData['Product'] || productData['Product Code'] || productData['Shipment Code']) {
          importedProducts.push(productData);
        }
      }

      if (importedProducts.length === 0) {
        notifications.show({
          title: '⚠️ Import Warning',
          message: 'No valid product data found in the CSV file',
          color: 'yellow',
          autoClose: 4000,
        });
        return;
      }

      // Save to database via API
      const saveResponse = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importedProducts),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save to database');
      }

      const saveResult = await saveResponse.json();

      // Update local state
      setProducts(importedProducts);
      setFilteredProducts(importedProducts);
      setFile(null); // Clear the file input

      notifications.show({
        title: '🎉 Import Successful!',
        message: `Successfully imported ${saveResult.count} product records to database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

    } catch (error) {
      console.error('Import error:', error);
      notifications.show({
        title: '❌ Import Failed',
        message: 'Failed to parse CSV file. Please check the file format.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  // Define column alignment mappings
  const getColumnAlignment = (columnId: string): 'left' | 'center' | 'right' => {
    // Center Align columns
    const centerAlignColumns = [
      'shipmentCode', 'cvNumber', 'noOfSacks', 'totalCBM', 'weight', 
      'shipmentStatus', 'postingDate', 'orderDate', 'payment'
    ];
    
    // Left Align columns
    const leftAlignColumns = [
      'product', 'productCode', 'ageRange', 'unit', 'quantity'
    ];
    
    // Right Align columns (financial data)
    const rightAlignColumns = [
      'unitPrice', 'alibabaShippingCost', 'exchangeRates', 'php', 'subTotalPHP',
      'transactionFee', 'grandTotal', 'forwardersFee', 'lalamove',
      'packagingCost', 'suggestedPrice', 'actualPrice', 'basePrice', 'cogs',
      'projectedSales', 'projectedProfit', 'projectedProfitPercent', 'totalMarkup'
    ];
    
    if (centerAlignColumns.includes(columnId)) return 'center';
    if (leftAlignColumns.includes(columnId)) return 'left';
    if (rightAlignColumns.includes(columnId)) return 'right';
    
    return 'left'; // default alignment
  };

  // Define columns that should display with 2 decimal places
  const getTwoDecimalPlaces = (columnId: string): boolean => {
    const twoDecimalColumns = [
      'unitPrice', 'alibabaShippingCost', 'exchangeRates', 'php', 'subTotalPHP',
      'transactionFee', 'grandTotal', 'forwardersFee', 'lalamove',
      'packagingCost', 'suggestedPrice', 'actualPrice', 'basePrice', 'cogs',
      'projectedSales', 'projectedProfit', 'projectedProfitPercent', 'totalMarkup'
    ];
    return twoDecimalColumns.includes(columnId);
  };

  // Handle paste into grid (multi-cell)
  const handlePaste = useCallback((target: Item, values: readonly (readonly string[])[]) => {
    if (!pasteMode) return false;
    const [startCol, startRow] = target;
    let applied = 0;
    let clipped = false;
    const nextProducts = [...products];

    const makeEmpty = (): ProductData => ({
      'Shipment Code': '',
      'CV Number': '',
      'No. Of Sacks': 0,
      'Total CBM': 0,
      'Weight': 0,
      'Shipment Status': '',
      'Posting Date': '',
      'Order Date': '',
      'Payment': '',
      'Product': '',
      'Product Code': '',
      'Age Range': '',
      'Unit': '',
      'Unit Price': 0,
      'Quantity': 0,
      'Alibaba Shipping Cost': 0,
      'Exchange Rates': 0,
      'PHP': 0,
      'Sub Total (PHP)': 0,
      'Transaction Fee': 0,
      'Grand Total': 0,
      'Forwarder\'s Fee': 0,
      'Lalamove': 0,
      'Packaging Cost': 0,
      'Suggested Price': 0,
      'Actual Price': 0,
      'Base Price': 0,
      'COGS': 0,
      'Projected Sales': 0,
      'Projected Profit': 0,
      'Projected Profit (%)': 0,
      'Total Markup': 0,
    });

    for (let r = 0; r < values.length; r++) {
      const rowIdx = startRow + r;
      const rowData = values[r] ?? [];

      // Determine the global index to write to (existing filtered row or append)
      let globalIndex: number;
      if (rowIdx < filteredProducts.length) {
        const rowObj = filteredProducts[rowIdx];
        globalIndex = nextProducts.indexOf(rowObj);
        if (globalIndex === -1) {
          nextProducts.push(makeEmpty());
          globalIndex = nextProducts.length - 1;
        }
      } else {
        nextProducts.push(makeEmpty());
        globalIndex = nextProducts.length - 1;
      }

      for (let c = 0; c < rowData.length; c++) {
        const colIdx = startCol + c;
        if (colIdx >= columns.length) { clipped = true; break; }
        const v = (rowData[c] ?? '').toString();
        const col = columns[colIdx];
        const key = col ? idToKey[col.id ?? ''] : undefined;
        if (key) {
          const updated: ProductData = { ...nextProducts[globalIndex], [key]: v } as ProductData;
          nextProducts[globalIndex] = updated;
          applied++;
        }
      }
    }

    if (applied > 0) {
      // Persist full dataset via bulk sync for simplicity
      (async () => {
        try {
          const res = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextProducts),
          });
          if (!res.ok) {
            let msg = 'Failed to persist pasted rows';
            try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
            notifications.show({ title: 'Paste saved locally only', message: msg, color: 'yellow' });
          }
        } catch (e) {
          console.error('Failed to persist pasted rows', e);
          notifications.show({ title: 'Paste saved locally only', message: 'Database not reachable', color: 'yellow' });
        }
      })();

      setProducts(nextProducts);
      if (!searchQuery.trim()) {
        setFilteredProducts(nextProducts);
      } else {
        const q = searchQuery.toLowerCase();
        setFilteredProducts(nextProducts.filter((product) =>
          Object.values(product).some(val => 
            val && val.toString().toLowerCase().includes(q)
          )
        ));
      }

      notifications.show({
        title: 'Pasted into table',
        message: `Applied ${applied} cell${applied === 1 ? '' : 's'}${clipped ? ' (some data clipped to grid size)' : ''}`,
        color: 'blue',
      });

      return true;
    }
    return false;
  }, [pasteMode, products, filteredProducts, columns, searchQuery, idToKey]);

  // Get cell data for the grid
  const getData = useCallback((cell: Item): any => {
    const [col, row] = cell;
    const product = filteredProducts[row];
    const column = columns[col];
    
    if (!product || !column) {
      return {
        kind: GridCellKind.Text,
        data: '',
        displayData: '',
        allowOverlay: false,
        contentAlign: 'center',
      };
    }

    const key = idToKey[column.id as string];
    const value = product[key];
    const alignment = getColumnAlignment(column.id as string);
    const useTwoDecimals = getTwoDecimalPlaces(column.id as string);

    // Handle different data types
    if (typeof value === 'number') {
      const displayData = useTwoDecimals 
        ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : value.toLocaleString();
        
      return {
        kind: GridCellKind.Number,
        data: value,
        displayData: displayData,
        allowOverlay: false,
        contentAlign: alignment,
      };
    }

    return {
      kind: GridCellKind.Text,
      data: value?.toString() || '',
      displayData: value?.toString() || '',
      allowOverlay: false,
      contentAlign: alignment,
    };
  }, [filteredProducts, columns, idToKey]);

  // Set grid height to 83vh
  useEffect(() => {
    const updateGridHeight = () => {
      const vh83 = window.innerHeight * 0.83;
      setGridHeight(vh83);
    };

    updateGridHeight();
    window.addEventListener('resize', updateGridHeight);
    return () => window.removeEventListener('resize', updateGridHeight);
  }, []);

  // Handle Ctrl+F to focus search bar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault(); // Prevent browser's find dialog
        searchInputRef.current?.focus();
        searchInputRef.current?.select(); // Select existing text if any
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Custom header drawing function
  const drawHeader = useCallback((args: any) => {
    const { ctx, column, rect, theme } = args;
    
    // Fill header background
    ctx.fillStyle = theme.bgHeader;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    
    // Set text properties
    ctx.fillStyle = theme.textHeader;
    ctx.font = theme.headerFontStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw centered text
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(column.title, centerX, centerY);
    
    return true;
  }, []);

  // Get row count
  const getRowCount = useCallback(() => filteredProducts.length, [filteredProducts]);

  // Handle cell clicks
  const onCellClicked = useCallback((cell: Item) => {
    const [col, row] = cell;
    const product = filteredProducts[row];
    const column = columns[col];
    
    if (!product || !column) return;

    // You can add specific click handling here if needed
    console.log('Clicked cell:', { product, column: column.title });
  }, [filteredProducts, columns]);

  return (
    <PageLayout fluid withPadding>
      <style dangerouslySetInnerHTML={{ __html: customGridStyles }} />
      <Stack gap="md" style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}>
        {/* Stats cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Card shadow="sm" padding="md" radius="md" style={{ background: 'var(--mantine-color-blue-6)', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>Total Products</Text>
                <Title order={3} c="white">{stats.total}</Title>
              </div>
              <ThemeIcon variant="white" color="blue" size="lg" radius="md">
                <IconCurrencyDollar size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="md" radius="md" style={{ background: 'var(--mantine-color-green-6)', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>Total Value</Text>
                <Title order={3} c="white">₱{stats.totalValue.toLocaleString()}</Title>
              </div>
              <ThemeIcon variant="white" color="green" size="lg" radius="md">
                <IconTrendingUp size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="md" radius="md" style={{ background: '#fd7e14', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>Average Value</Text>
                <Title order={3} c="white">₱{stats.avgValue.toLocaleString()}</Title>
              </div>
              <ThemeIcon variant="white" color="orange" size="lg" radius="md">
                <IconAdjustments size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="md" radius="md" style={{ background: '#9775fa', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>Total Profit</Text>
                <Title order={3} c="white">₱{stats.totalProfit.toLocaleString()}</Title>
              </div>
              <ThemeIcon variant="white" color="purple" size="lg" radius="md">
                <IconTrendingUp size={18} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        {/* Search and controls */}
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <TextInput
            ref={searchInputRef}
            placeholder="Search products by code, name, shipment code..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.currentTarget?.value || '')}
            style={{ flex: 1, minWidth: 300 }}
            size="md"
            radius="md"
          />
          
          <Group gap="sm">
            <Button
              variant={pasteMode ? 'filled' : 'outline'}
              color={pasteMode ? 'yellow' : 'gray'}
              size="md"
              radius="md"
              onClick={() => setPasteMode((v) => !v)}
            >
              {pasteMode ? 'Disable Paste Mode' : 'Enable Paste Mode'}
            </Button>
            <FileInput
              placeholder="Select CSV file"
              accept=".csv"
              value={file}
              onChange={setFile}
              leftSection={<IconUpload size={16} />}
              size="md"
              radius="md"
              style={{ minWidth: 200 }}
            />
            <Button
              onClick={handleCSVImport}
              disabled={!file}
              leftSection={<IconUpload size={16} />}
              size="md"
              radius="md"
              color="blue"
            >
              Import CSV
            </Button>
            <Button 
              leftSection={<IconPlus size={16} />} 
              variant="filled" 
              color="green" 
              size="md" 
              radius="md"
              onClick={() => setAddProductOpen(true)}
            >
              Add Product
            </Button>
          </Group>
        </Group>

        {/* Add Product Modal - Beautiful & Modern Design */}
        <Modal 
          opened={addProductOpen} 
          onClose={() => setAddProductOpen(false)}
          closeOnClickOutside={false}
          closeOnEscape={false}
          withCloseButton={true}
          size="95%"
          radius="lg"
          shadow="xl"
          centered
          padding="xl"
          styles={{
            header: {
              backgroundColor: 'var(--mantine-color-green-0)',
              borderRadius: '12px 12px 0 0',
              padding: '24px 32px 16px 32px',
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            },
            title: {
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--mantine-color-green-8)',
            },
            body: {
              padding: '32px',
              backgroundColor: 'var(--mantine-color-gray-0)',
            },
            close: {
              color: 'var(--mantine-color-green-6)',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-green-1)',
              },
            },
          }}
          title={
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="green">
                <IconPackage size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={600} c="green.8">Add New Product</Text>
                <Text size="sm" c="dimmed">Fill in the product information below</Text>
              </div>
            </Group>
          }
        >
          <Stack gap="lg">
            {/* Basic Product Information Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="green">
                  <IconPackage size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="green.7">Basic Product Information</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                <TextInput
                  label="Shipment Code"
                  placeholder="e.g. KPC 23930A-00173"
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  value={newProductForm.shipmentCode}
                  onChange={(e) => updateFormField('shipmentCode', e.currentTarget?.value || '')}
                />
                
                <TextInput
                  label="Product Name"
                  placeholder="e.g. Premium T-Shirt"
                  withAsterisk
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  value={newProductForm.product}
                  onChange={(e) => updateFormField('product', e.currentTarget?.value || '')}
                />

                <Select
                  label="Age Range"
                  placeholder="Select age range"
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  data={[
                    { label: '👶 Baby (0-2 years)', value: 'Baby' },
                    { label: '🧒 Kids (3-12 years)', value: 'Kids' },
                    { label: '👦 Teen (13-17 years)', value: 'Teen' },
                    { label: '👨 Adult (18-64 years)', value: 'Adult' },
                    { label: '👴 Senior (65+ years)', value: 'Senior' },
                    { label: '🌟 All Ages', value: 'All Ages' },
                  ]}
                  allowDeselect
                  clearable
                  value={newProductForm.ageRange || null}
                  onChange={(value) => updateFormField('ageRange', value || '')}
                />

                <Select
                  label="Unit"
                  placeholder="Select unit"
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  data={[
                    { label: '📦 Pieces', value: 'Pieces' },
                    { label: '🎁 Sets', value: 'Sets' },
                    { label: '👟 Pairs', value: 'Pairs' },
                    { label: '📦 Packs', value: 'Packs' },
                  ]}
                  allowDeselect
                  clearable
                  value={newProductForm.unit || null}
                  onChange={(value) => updateFormField('unit', value || '')}
                />
              </SimpleGrid>
            </div>

            {/* Date & Payment Information Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                  <IconCalendar size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="blue.7">Date & Payment Information</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <TextInput
                  label="Posting Date"
                  placeholder="YYYY-MM-DD"
                  type="date"
                  size="md"
                  radius="md"
                  leftSection={<IconCalendar size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                    }
                  }}
                  value={newProductForm.postingDate}
                  onChange={(e) => updateFormField('postingDate', e.currentTarget?.value || '')}
                />
                
                <TextInput
                  label="Order Date"
                  placeholder="YYYY-MM-DD"
                  type="date"
                  size="md"
                  radius="md"
                  leftSection={<IconCalendar size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                    }
                  }}
                  value={newProductForm.orderDate}
                  onChange={(e) => updateFormField('orderDate', e.currentTarget?.value || '')}
                />

                <Select
                  label="Payment"
                  placeholder="Select payment status"
                  size="md"
                  radius="md"
                  leftSection={<IconCreditCard size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                    }
                  }}
                  data={[
                    { label: '✅ Paid', value: 'Paid' },
                    { label: '⏳ Unpaid', value: 'Unpaid' },
                  ]}
                  allowDeselect
                  clearable
                  value={newProductForm.payment || null}
                  onChange={(value) => updateFormField('payment', value || '')}
                />
              </SimpleGrid>
            </div>

            {/* Pricing & Quantity Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="orange">
                  <IconCurrencyDollar size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="orange.7">Pricing & Quantity</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                <NumberInput
                  label="Unit Price"
                  placeholder="0.00"
                  size="md"
                  radius="md"
                  leftSection="₱"
                  decimalScale={2}
                  fixedDecimalScale
                  thousandSeparator=","
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-orange-5)' }
                    }
                  }}
                  value={newProductForm.unitPrice}
                  onChange={(value) => updateFormField('unitPrice', Number(value) || 0)}
                />
                
                <NumberInput
                  label="Quantity"
                  placeholder="0"
                  size="md"
                  radius="md"
                  min={0}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-orange-5)' }
                    }
                  }}
                  value={newProductForm.quantity}
                  onChange={(value) => updateFormField('quantity', Number(value) || 0)}
                />

                <NumberInput
                  label="Exchange Rate"
                  placeholder="1.00"
                  size="md"
                  radius="md"
                  decimalScale={4}
                  fixedDecimalScale
                  step={0.0001}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-orange-5)' }
                    }
                  }}
                  value={newProductForm.exchangeRates}
                  onChange={(value) => updateFormField('exchangeRates', Number(value) || 1)}
                />
              </SimpleGrid>
            </div>

            {/* Shipping & Additional Fees Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="purple">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="purple.7">Shipping & Additional Fees</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="md">
                <NumberInput
                  label="Alibaba Shipping Cost"
                  placeholder="0.00"
                  size="md"
                  radius="md"
                  leftSection="₱"
                  decimalScale={2}
                  fixedDecimalScale
                  thousandSeparator=","
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-purple-5)' }
                    }
                  }}
                  value={newProductForm.alibabaShippingCost}
                  onChange={(value) => updateFormField('alibabaShippingCost', Number(value) || 0)}
                />
                
                <NumberInput
                  label="Forwarder's Fee"
                  placeholder="0.00"
                  size="md"
                  radius="md"
                  leftSection="₱"
                  decimalScale={2}
                  fixedDecimalScale
                  thousandSeparator=","
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-purple-5)' }
                    }
                  }}
                  value={newProductForm.forwardersFee}
                  onChange={(value) => updateFormField('forwardersFee', Number(value) || 0)}
                />

                <NumberInput
                  label="Lalamove"
                  placeholder="0.00"
                  size="md"
                  radius="md"
                  leftSection="₱"
                  decimalScale={2}
                  fixedDecimalScale
                  thousandSeparator=","
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-purple-5)' }
                    }
                  }}
                  value={newProductForm.lalamove}
                  onChange={(value) => updateFormField('lalamove', Number(value) || 0)}
                />

                <NumberInput
                  label="Packaging Cost"
                  placeholder="0.00"
                  size="md"
                  radius="md"
                  leftSection="₱"
                  decimalScale={2}
                  fixedDecimalScale
                  thousandSeparator=","
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-purple-5)' }
                    }
                  }}
                  value={newProductForm.packagingCost}
                  onChange={(value) => updateFormField('packagingCost', Number(value) || 0)}
                />

                <NumberInput
                  label="Actual Price"
                  placeholder="0.00"
                  size="md"
                  radius="md"
                  leftSection="₱"
                  decimalScale={2}
                  fixedDecimalScale
                  thousandSeparator=","
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-purple-5)' }
                    }
                  }}
                  value={newProductForm.actualPrice}
                  onChange={(value) => updateFormField('actualPrice', Number(value) || 0)}
                />
              </SimpleGrid>
            </div>

            {/* Financial Calculations Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
                  <IconCurrencyDollar size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="indigo.7">Financial Calculations & Business Intelligence</Text>
              </Group>
              
              {/* First Row - Key Profit Metrics */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="md">
                {/* Suggested Price Calculation */}
                <Card 
                  withBorder 
                  radius="md" 
                  padding="md"
                  style={{ 
                    backgroundColor: 'var(--mantine-color-indigo-0)',
                    borderColor: 'var(--mantine-color-indigo-3)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
                      <IconCurrencyDollar size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500} c="indigo.7">Suggested Price</Text>
                  </Group>
                  <Text size="xl" fw={700} c="indigo.8" ta="center" mb="xs">
                    ₱{(newProductForm.quantity > 0 
                      ? Math.ceil(((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost) / newProductForm.quantity * 1.22)
                      : 0
                    ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Minimum selling price (122% markup)
                  </Text>
                </Card>

                {/* Projected Sales Total */}
                <Card 
                  withBorder 
                  radius="md" 
                  padding="md"
                  style={{ 
                    backgroundColor: 'var(--mantine-color-green-0)',
                    borderColor: 'var(--mantine-color-green-3)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <ThemeIcon size="sm" radius="md" variant="light" color="green">
                      <IconTrendingUp size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500} c="green.7">Projected Sales Total</Text>
                  </Group>
                  <Text size="xl" fw={700} c="green.8" ta="center" mb="xs">
                    ₱{(newProductForm.actualPrice * newProductForm.quantity).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Total revenue (Actual Price × Quantity)
                  </Text>
                </Card>

                {/* Projected Profit */}
                <Card 
                  withBorder 
                  radius="md" 
                  padding="md"
                  style={{ 
                    backgroundColor: 'var(--mantine-color-teal-0)',
                    borderColor: 'var(--mantine-color-teal-3)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <ThemeIcon size="sm" radius="md" variant="light" color="teal">
                      <IconTrendingUp size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500} c="teal.7">Projected Profit</Text>
                  </Group>
                  <Text size="xl" fw={700} c="teal.8" ta="center" mb="xs">
                    ₱{((newProductForm.actualPrice * newProductForm.quantity) - ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost)).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Expected profit (Revenue - Costs)
                  </Text>
                </Card>

                {/* Profit Margin (Projected Profit %) */}
                <Card 
                  withBorder 
                  radius="md" 
                  padding="md"
                  style={{ 
                    backgroundColor: 'var(--mantine-color-blue-0)',
                    borderColor: 'var(--mantine-color-blue-3)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                      <IconPercentage size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500} c="blue.7">Profit Margin</Text>
                  </Group>
                  <Text size="xl" fw={700} c="blue.8" ta="center" mb="xs">
                    {(() => {
                      const cogs = (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost;
                      const projectedProfit = (newProductForm.actualPrice * newProductForm.quantity) - cogs;
                      
                      if (cogs === 0) return '0.00%';
                      
                      const profitPercentage = (projectedProfit / cogs) * 100;
                      return `${profitPercentage.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}%`;
                    })()}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Profit as % of costs invested
                  </Text>
                </Card>
              </SimpleGrid>
              
              {/* Second Row - Cost & Markup Metrics */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {/* Base Price */}
                <Card 
                  withBorder 
                  radius="md" 
                  padding="md"
                  style={{ 
                    backgroundColor: 'var(--mantine-color-blue-0)',
                    borderColor: 'var(--mantine-color-blue-3)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                      <IconCurrencyDollar size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500} c="blue.7">Base Price</Text>
                  </Group>
                  <Text size="xl" fw={700} c="blue.8" ta="center" mb="xs">
                    ₱{(newProductForm.quantity > 0 
                      ? ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost) / newProductForm.quantity
                      : 0
                    ).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Cost per item (COGS ÷ Quantity)
                  </Text>
                </Card>

                {/* COGS (Cost of Goods Sold) */}
                <Card 
                  withBorder 
                  radius="md" 
                  padding="md"
                  style={{ 
                    backgroundColor: 'var(--mantine-color-red-0)',
                    borderColor: 'var(--mantine-color-red-3)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <ThemeIcon size="sm" radius="md" variant="light" color="red">
                      <IconTrendingDown size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500} c="red.7">COGS</Text>
                  </Group>
                  <Text size="xl" fw={700} c="red.8" ta="center" mb="xs">
                    ₱{((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Total cost to acquire & deliver
                  </Text>
                </Card>

                {/* Total Markup */}
                <Card 
                  withBorder 
                  radius="md" 
                  padding="md"
                  style={{ 
                    backgroundColor: 'var(--mantine-color-violet-0)',
                    borderColor: 'var(--mantine-color-violet-3)'
                  }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <ThemeIcon size="sm" radius="md" variant="light" color="violet">
                      <IconTrendingUp size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500} c="violet.7">Total Markup</Text>
                  </Group>
                  <Text size="xl" fw={700} c="violet.8" ta="center" mb="xs">
                    ₱{(() => {
                      const totalMarkup = (newProductForm.actualPrice - newProductForm.unitPrice) * newProductForm.quantity;
                      return totalMarkup.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      });
                    })()}
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Price increase from cost to selling
                  </Text>
                </Card>
              </SimpleGrid>
            </div>

            {/* Action Buttons */}
            <Group justify="flex-end" mt="xl" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <Button 
                variant="subtle" 
                size="md"
                radius="md"
                onClick={() => {
                  setAddProductOpen(false);
                  resetForm();
                }}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                    }
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                size="md"
                radius="md"
                gradient={{ from: 'green', to: 'green.6', deg: 45 }}
                disabled={!newProductForm.product.trim()}
                leftSection={<IconPlus size={18} />}
                styles={{
                  root: {
                    boxShadow: '0 4px 12px rgba(51, 217, 178, 0.2)',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(51, 217, 178, 0.3)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                  }
                }}
                onClick={async () => {
                  try {
                    const newProduct: Partial<ProductData> = {
                      'Shipment Code': newProductForm.shipmentCode.trim(),
                      'CV Number': '', // Set default empty
                      'No. Of Sacks': 0, // Set default 0
                      'Total CBM': 0, // Set default 0
                      'Weight': 0, // Set default 0
                      'Shipment Status': '', // Keep blank for formula later
                      'Posting Date': newProductForm.postingDate,
                      'Order Date': newProductForm.orderDate,
                      'Payment': newProductForm.payment,
                      'Product': newProductForm.product.trim(),
                      'Product Code': generateProductCode(newProductForm.product.trim(), newProductForm.postingDate),
                      'Age Range': newProductForm.ageRange,
                      'Unit': newProductForm.unit,
                      'Unit Price': newProductForm.unitPrice,
                      'Quantity': newProductForm.quantity,
                      'Alibaba Shipping Cost': newProductForm.alibabaShippingCost,
                      'Exchange Rates': newProductForm.exchangeRates,
                      'PHP': newProductForm.unitPrice * newProductForm.exchangeRates, // PHP = Unit Price × Exchange Rate
                      'Sub Total (PHP)': (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates, // Sub Total (PHP) = (Unit Price × Quantity + Alibaba Shipping Cost) × Exchange Rate
                      'Transaction Fee': (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299, // Transaction Fee = Sub Total (PHP) × 2.99%
                      'Grand Total': (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299, // Grand Total = Sub Total (PHP) + Transaction Fee
                      'Forwarder\'s Fee': newProductForm.forwardersFee,
                      'Lalamove': newProductForm.lalamove,  
                      'Packaging Cost': newProductForm.packagingCost,
                      'Suggested Price': Math.ceil((newProductForm.quantity > 0 ? ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost) / newProductForm.quantity : 0) * 1.22), // Suggested Price = ROUNDUP(Base Price * 122%)
                      'Actual Price': newProductForm.actualPrice,
                      'Base Price': newProductForm.quantity > 0 ? ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost) / newProductForm.quantity : 0, // Base Price = COGS / Quantity
                      'COGS': (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost, // COGS = Grand Total + Forwarder's Fee + Lalamove + Packaging Cost
                      'Projected Sales': newProductForm.actualPrice * newProductForm.quantity, // Projected Sales Total = Actual Price × Quantity
                      'Projected Profit': (newProductForm.actualPrice * newProductForm.quantity) - ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost), // Projected Profit = Projected Sales Total - COGS
                      'Projected Profit (%)': ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost) > 0 ? (((newProductForm.actualPrice * newProductForm.quantity) - ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost)) / ((newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates + (newProductForm.unitPrice * newProductForm.quantity + newProductForm.alibabaShippingCost) * newProductForm.exchangeRates * 0.0299 + newProductForm.forwardersFee + newProductForm.lalamove + newProductForm.packagingCost)) * 100 : 0, // Projected Profit (%) = (Projected Profit / COGS) * 100
                      'Total Markup': (newProductForm.unitPrice * newProductForm.exchangeRates) > 0 ? (newProductForm.actualPrice / (newProductForm.unitPrice * newProductForm.exchangeRates)) * 100 : 0, // Total Markup = (Actual Price / PHP) * 100
                    };

                    // Add to local state first
                    const updatedProducts = [newProduct as ProductData, ...products];
                    setProducts(updatedProducts);
                    
                    // Update filtered products if no search query
                    if (!searchQuery.trim()) {
                      setFilteredProducts(updatedProducts);
                    } else {
                      // Re-apply search filter
                      const filtered = updatedProducts.filter(product => {
                        const searchTerm = searchQuery.toLowerCase();
                        return (
                          product['Shipment Code'].toLowerCase().includes(searchTerm) ||
                          product['CV Number'].toLowerCase().includes(searchTerm) ||
                          product['Product'].toLowerCase().includes(searchTerm) ||
                          product['Product Code'].toLowerCase().includes(searchTerm) ||
                          product['Shipment Status'].toLowerCase().includes(searchTerm)
                        );
                      });
                      setFilteredProducts(filtered);
                    }

                    // Try to save to database
                    try {
                      const response = await fetch('/api/products', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify([newProduct]),
                      });

                      if (!response.ok) {
                        throw new Error('Failed to save to database');
                      }
                    } catch (dbError) {
                      console.error('Database save failed:', dbError);
                      notifications.show({
                        title: 'Product added locally',
                        message: 'Product saved locally but failed to sync with database',
                        color: 'yellow',
                        autoClose: 4000,
                      });
                    }

                    // Reset form and close modal
                    resetForm();
                    setAddProductOpen(false);

                    // Success notification
                    notifications.show({
                      title: '🎉 Product Added Successfully!',
                      message: `${newProductForm.product} has been added to your product catalog`,
                      color: 'green',
                      icon: <IconCheck size={18} />,
                      autoClose: 4000,
                    });

                  } catch (error) {
                    console.error('Failed to add product:', error);
                    notifications.show({
                      title: '❌ Failed to Add Product',
                      message: 'An error occurred while adding the product. Please try again.',
                      color: 'red',
                      autoClose: 4000,
                    });
                  }
                }}
              >
                Add Product
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Data Grid */}
        <Card withBorder shadow="sm" radius="md" padding={0} style={{
          height: gridHeight,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
          fontSize: '18px'
        }} className="data-grid-container">
          <DataEditor
            getCellContent={getData}
            columns={columnsWithAutoSize}
            rows={getRowCount()}
            height={gridHeight}
            width={"100%"}
            overscrollX={0}
            smoothScrollX={true}
            smoothScrollY={true}
            rowHeight={70}
            headerHeight={80}
            rowMarkers="number"
            onCellClicked={onCellClicked}
            onPaste={pasteMode ? handlePaste : undefined}
            isDraggable={false}
            experimental={{
              scrollbarWidthOverride: 16,
            }}
            drawHeader={drawHeader}
            theme={{
              // Updated font sizes for better readability
              accentColor: '#228be6',
              accentLight: 'rgba(34, 139, 230, 0.1)',
              textDark: '#212529',
              textMedium: '#495057',
              textLight: '#868e96',
              textBubble: '#ffffff',
              bgIconHeader: '#f8f9fa',
              fgIconHeader: '#495057',
              textHeader: '#343a40',
              textHeaderSelected: '#228be6',
              bgCell: '#ffffff',
              bgCellMedium: '#ffffff',
              bgHeader: '#f8f9fa',
              bgHeaderHasFocus: '#e9ecef',
              bgHeaderHovered: '#e9ecef',
              bgBubble: '#228be6',
              bgBubbleSelected: '#1c7ed6',
              bgSearchResult: '#fff3cd',
              borderColor: 'rgba(206, 212, 218, 0.5)',
              drilldownBorder: 'rgba(34, 139, 230, 0.4)',
              linkColor: '#228be6',
              headerFontStyle: 'bold 17px Inter',
              baseFontStyle: '17px Inter',
              editorFontSize: '20',
              fontFamily: 'Inter',
              cellHorizontalPadding: 12,
              cellVerticalPadding: 8,
            }}
            getCellsForSelection={true}
          />
        </Card>

        {/* Footer info */}
        <Group justify="space-between" align="center" style={{ marginTop: 'md' }}>
          <Text size="sm" c="dimmed">
            Showing {filteredProducts.length} of {products.length} products
          </Text>
          <Text size="sm" c="dimmed">
            Total Value: ₱{stats.totalValue.toLocaleString()} | Total Profit: ₱{stats.totalProfit.toLocaleString()}
          </Text>
        </Group>
      </Stack>
    </PageLayout>
  );
}
