'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { GridCellKind, GridColumn, Item } from '@glideapps/glide-data-grid';
import { Stack, Text, Box, Button, Group, FileInput, Loader, TextInput, Card, SimpleGrid, ThemeIcon, Title, Modal, Select, NumberInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconSearch, IconCurrencyDollar, IconFilter, IconTrendingUp, IconTrendingDown, IconPlus, IconUser, IconMail, IconMapPin, IconCheck, IconAdjustments, IconPackage, IconCalendar, IconCreditCard } from '@tabler/icons-react';

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
  'Shipping Fee 1': number;
  'Exchange Rates': number;
  'PHP': number;
  'Sub Total (PHP)': number;
  'Transaction Fee': number;
  'Grand Total': number;
  'Shipping Fee 2': number;
  'Shipping Fee 3': number;
  'Packaging': number;
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
    shippingFee1: 0,
    exchangeRates: 1,
    shippingFee2: 0,
    shippingFee3: 0,
    packaging: 0,
    actualPrice: 0,
  }));

  // Define columns with all the headers you specified
  const columns: GridColumn[] = [
    { title: 'Shipment Code', width: 150, id: 'shipmentCode', grow: 1 },
    { title: 'CV Number', width: 120, id: 'cvNumber' },
    { title: 'No. Of Sacks', width: 120, id: 'noOfSacks' },
    { title: 'Total CBM', width: 120, id: 'totalCBM' },
    { title: 'Weight', width: 100, id: 'weight' },
    { title: 'Shipment Status', width: 150, id: 'shipmentStatus' },
    { title: 'Posting Date', width: 130, id: 'postingDate' },
    { title: 'Order Date', width: 130, id: 'orderDate' },
    { title: 'Payment', width: 120, id: 'payment' },
    { title: 'Product', width: 200, id: 'product' },
    { title: 'Product Code', width: 150, id: 'productCode' },
    { title: 'Age Range', width: 120, id: 'ageRange' },
    { title: 'Unit', width: 100, id: 'unit' },
    { title: 'Unit Price', width: 120, id: 'unitPrice' },
    { title: 'Quantity', width: 100, id: 'quantity' },
    { title: 'Shipping Fee 1', width: 130, id: 'shippingFee1' },
    { title: 'Exchange Rates', width: 140, id: 'exchangeRates' },
    { title: 'PHP', width: 100, id: 'php' },
    { title: 'Sub Total (PHP)', width: 150, id: 'subTotalPHP' },
    { title: 'Transaction Fee', width: 140, id: 'transactionFee' },
    { title: 'Grand Total', width: 130, id: 'grandTotal' },
    { title: 'Shipping Fee 2', width: 130, id: 'shippingFee2' },
    { title: 'Shipping Fee 3', width: 130, id: 'shippingFee3' },
    { title: 'Packaging', width: 120, id: 'packaging' },
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
    shippingFee1: 'Shipping Fee 1',
    exchangeRates: 'Exchange Rates',
    php: 'PHP',
    subTotalPHP: 'Sub Total (PHP)',
    transactionFee: 'Transaction Fee',
    grandTotal: 'Grand Total',
    shippingFee2: 'Shipping Fee 2',
    shippingFee3: 'Shipping Fee 3',
    packaging: 'Packaging',
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
      shippingFee1: 0,
      exchangeRates: 1,
      shippingFee2: 0,
      shippingFee3: 0,
      packaging: 0,
      actualPrice: 0,
    });
  }, []);

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
              'Shipping Fee 1': product.shippingFee1 || 0,
              'Exchange Rates': product.exchangeRates || 0,
              'PHP': product.php || 0,
              'Sub Total (PHP)': product.subTotalPHP || 0,
              'Transaction Fee': product.transactionFee || 0,
              'Grand Total': product.grandTotal || 0,
              'Shipping Fee 2': product.shippingFee2 || 0,
              'Shipping Fee 3': product.shippingFee3 || 0,
              'Packaging': product.packaging || 0,
              'Suggested Price': product.suggestedPrice || 0,
              'Actual Price': product.actualPrice || 0,
              'Base Price': product.basePrice || 0,
              'COGS': product.cogs || 0,
              'Projected Sales': product.projectedSales || 0,
              'Projected Profit': product.projectedProfit || 0,
              'Projected Profit (%)': product.projectedProfitPercent || 0,
              'Total Markup': product.totalMarkup || 0,
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
          'Shipping Fee 1': parseNumeric(values[15]),
          'Exchange Rates': parseNumeric(values[16]),
          'PHP': parseNumeric(values[17]),
          'Sub Total (PHP)': parseNumeric(values[18]),
          'Transaction Fee': parseNumeric(values[19]),
          'Grand Total': parseNumeric(values[20]),
          'Shipping Fee 2': parseNumeric(values[21]),
          'Shipping Fee 3': parseNumeric(values[22]),
          'Packaging': parseNumeric(values[23]),
          'Suggested Price': parseNumeric(values[24]),
          'Actual Price': parseNumeric(values[25]),
          'Base Price': parseNumeric(values[26]),
          'COGS': parseNumeric(values[27]),
          'Projected Sales': parseNumeric(values[28]),
          'Projected Profit': parseNumeric(values[29]),
          'Projected Profit (%)': parseNumeric(values[30]),
          'Total Markup': parseNumeric(values[31]),
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
      };
    }

    const key = idToKey[column.id as string];
    const value = product[key];

    // Handle different data types
    if (typeof value === 'number') {
      return {
        kind: GridCellKind.Number,
        data: value,
        displayData: value.toLocaleString(),
        allowOverlay: false,
      };
    }

    return {
      kind: GridCellKind.Text,
      data: value?.toString() || '',
      displayData: value?.toString() || '',
      allowOverlay: false,
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
          size="xl"
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
              
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Shipment Code"
                  placeholder="e.g. KPC 23930A-00173"
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
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
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
                      '&:focus': { borderColor: 'var(--mantine-color-orange-5)' }
                    }
                  }}
                  value={newProductForm.actualPrice}
                  onChange={(value) => updateFormField('actualPrice', Number(value) || 0)}
                />
              </SimpleGrid>
            </div>

            {/* Shipping & Fees Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="purple">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="purple.7">Shipping & Additional Fees</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                <NumberInput
                  label="Shipping Fee 1"
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
                  value={newProductForm.shippingFee1}
                  onChange={(value) => updateFormField('shippingFee1', Number(value) || 0)}
                />
                
                <NumberInput
                  label="Shipping Fee 2"
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
                  value={newProductForm.shippingFee2}
                  onChange={(value) => updateFormField('shippingFee2', Number(value) || 0)}
                />

                <NumberInput
                  label="Shipping Fee 3"
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
                  value={newProductForm.shippingFee3}
                  onChange={(value) => updateFormField('shippingFee3', Number(value) || 0)}
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
                      '&:focus': { borderColor: 'var(--mantine-color-purple-5)' }
                    }
                  }}
                  value={newProductForm.exchangeRates}
                  onChange={(value) => updateFormField('exchangeRates', Number(value) || 1)}
                />

                <NumberInput
                  label="Packaging Fee"
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
                  value={newProductForm.packaging}
                  onChange={(value) => updateFormField('packaging', Number(value) || 0)}
                />
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
                disabled={!newProductForm.shipmentCode.trim() || !newProductForm.product.trim()}
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
                      'Shipment Status': 'Pending', // Set default status
                      'Posting Date': newProductForm.postingDate,
                      'Order Date': newProductForm.orderDate,
                      'Payment': newProductForm.payment,
                      'Product': newProductForm.product.trim(),
                      'Product Code': generateProductCode(newProductForm.product.trim(), newProductForm.postingDate),
                      'Age Range': newProductForm.ageRange,
                      'Unit': newProductForm.unit,
                      'Unit Price': newProductForm.unitPrice,
                      'Quantity': newProductForm.quantity,
                      'Shipping Fee 1': newProductForm.shippingFee1,
                      'Exchange Rates': newProductForm.exchangeRates,
                      'PHP': 0, // Calculate later if needed
                      'Sub Total (PHP)': newProductForm.unitPrice * newProductForm.quantity,
                      'Transaction Fee': 0, // Set default 0
                      'Grand Total': (newProductForm.unitPrice * newProductForm.quantity) + newProductForm.shippingFee1 + newProductForm.shippingFee2 + newProductForm.shippingFee3 + newProductForm.packaging,
                      'Shipping Fee 2': newProductForm.shippingFee2,
                      'Shipping Fee 3': newProductForm.shippingFee3,  
                      'Packaging': newProductForm.packaging,
                      'Suggested Price': 0, // Set default 0
                      'Actual Price': newProductForm.actualPrice,
                      'Base Price': 0, // Set default 0
                      'COGS': 0, // Set default 0
                      'Projected Sales': 0, // Set default 0
                      'Projected Profit': 0, // Set default 0
                      'Projected Profit (%)': 0, // Set default 0
                      'Total Markup': 0, // Set default 0
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
            columns={columns}
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
