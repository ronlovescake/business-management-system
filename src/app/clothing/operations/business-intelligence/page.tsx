'use client';

import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  Stack,
  Text,
  Group,
  Select,
  Paper,
  Title,
  SimpleGrid,
  Table,
  Loader,
  Center,
  Card,
  ThemeIcon,
} from '@mantine/core';
import {
  IconCurrencyDollar,
  IconShoppingCart,
  IconTrendingUp,
  IconPackage,
  IconUsers,
  IconCube,
  IconTruck,
  type Icon,
} from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface TransactionData {
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number | null;
  'Unit Price': number | null;
  Discount: number | null;
  Adjustment: number | null;
  'Line Total': number | null;
  'Order Status': string;
}

interface ProductData {
  'Product Code': string;
  Product: string;
  COGS: number;
  'Total CBM': number;
  'No. Of Sacks': number;
}

interface ShipmentData {
  'Shipment Code': string;
  'Total CBM': number;
  'No. Of Sacks': number;
}

interface TopCustomer {
  customerName: string;
  totalAmount: number;
  orderCount: number;
}

interface TopProduct {
  productCode: string;
  totalValue: number;
  quantity: number;
}

// ============================================================================
// STATCARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: string;
  icon: Icon;
  color: string;
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card
      shadow="xs"
      padding="md"
      radius="md"
      withBorder
      style={{
        borderColor: '#6b7280',
        borderWidth: '1px',
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text c="gray.5" size="xs" fw={500}>
            {title}
          </Text>
          <Title order={3} style={{ color: '#374151' }} mt="xs">
            {value}
          </Title>
        </div>
        <ThemeIcon variant="light" color={color} size="lg" radius="md">
          <Icon size={24} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

// ============================================================================
// DATE FILTER OPTIONS
// ============================================================================

const filterOptions = [
  { value: 'ytd', label: 'Year to Date' },
  { value: 'mtd', label: 'Month to Date' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'last3months', label: 'Last 3 Months' },
  { value: 'last6months', label: 'Last 6 Months' },
  { value: 'all', label: 'All Time' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDateRangeFilter(filter: string): (date: Date) => boolean {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (filter) {
    case 'ytd':
      return (date) => date >= startOfYear;
    case 'mtd':
      return (date) => date >= startOfMonth;
    case 'last7days':
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return (date) => date >= last7Days;
    case 'last30days':
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return (date) => date >= last30Days;
    case 'last3months':
      const last3Months = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return (date) => date >= last3Months;
    case 'last6months':
      const last6Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      return (date) => date >= last6Months;
    case 'all':
    default:
      return () => true;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BusinessIntelligence() {
  const [dateFilter, setDateFilter] = useState<string>('mtd');
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [transactionsRes, productsRes, shipmentsRes] = await Promise.all([
          fetch('/api/transactions', { next: { revalidate: 30 } }),
          fetch('/api/products', { next: { revalidate: 30 } }),
          fetch('/api/shipments', { next: { revalidate: 30 } }),
        ]);

        const transactionsData = await transactionsRes.json();
        const productsData = await productsRes.json();
        const shipmentsData = await shipmentsRes.json();

        setTransactions(transactionsData);
        setProducts(productsData);
        setShipments(shipmentsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // ============================================================================
  // COMPUTED METRICS
  // ============================================================================

  const metrics = useMemo(() => {
    const dateFilterFn = getDateRangeFilter(dateFilter);

    // Filter transactions by date
    const filteredTransactions = transactions.filter((t) => {
      if (!t['Order Date']) return false;
      const orderDate = new Date(t['Order Date']);
      return dateFilterFn(orderDate);
    });

    // YTD and MTD calculations
    const ytdTotal = filteredTransactions.reduce(
      (sum, t) => sum + (t['Line Total'] || 0),
      0
    );

    const mtdTotal = filteredTransactions.reduce((sum, t) => {
      if (!t['Order Date']) return sum;
      const orderDate = new Date(t['Order Date']);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (orderDate >= startOfMonth) {
        return sum + (t['Line Total'] || 0);
      }
      return sum;
    }, 0);

    // Most sold items by monetary value
    const productSales = new Map<string, TopProduct>();
    filteredTransactions.forEach((t) => {
      const code = t['Product Code'];
      if (!code) return;

      const existing = productSales.get(code);
      const lineTotal = t['Line Total'] || 0;
      const quantity = t['Quantity'] || 0;

      if (existing) {
        existing.totalValue += lineTotal;
        existing.quantity += quantity;
      } else {
        productSales.set(code, {
          productCode: code,
          totalValue: lineTotal,
          quantity: quantity,
        });
      }
    });

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    // Total COGS
    const totalCOGS = products.reduce((sum, p) => sum + (p.COGS || 0), 0);

    // Top 10 customers by total order amount
    const customerSales = new Map<string, TopCustomer>();
    filteredTransactions.forEach((t) => {
      const customer = t.Customers;
      if (!customer) return;

      const existing = customerSales.get(customer);
      const lineTotal = t['Line Total'] || 0;

      if (existing) {
        existing.totalAmount += lineTotal;
        existing.orderCount += 1;
      } else {
        customerSales.set(customer, {
          customerName: customer,
          totalAmount: lineTotal,
          orderCount: 1,
        });
      }
    });

    const topCustomers = Array.from(customerSales.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // Shipment metrics: running CBM, number of sacks
    const totalCBM = shipments.reduce(
      (sum, s) => sum + (s['Total CBM'] || 0),
      0
    );
    const totalSacks = shipments.reduce(
      (sum, s) => sum + (s['No. Of Sacks'] || 0),
      0
    );

    return {
      ytdTotal,
      mtdTotal,
      topProducts,
      totalCOGS,
      topCustomers,
      totalCBM,
      totalSacks,
      transactionCount: filteredTransactions.length,
    };
  }, [transactions, products, shipments, dateFilter]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <PageLayout title="Business Intelligence">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Business Intelligence">
      <Stack gap="xl">
        {/* Filter Dropdown */}
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Real-time business metrics and analytics
          </Text>
          <Select
            data={filterOptions}
            value={dateFilter}
            onChange={(value) => setDateFilter(value || 'mtd')}
            w={200}
            placeholder="Select time period"
            label="Time Period"
          />
        </Group>

        {/* TRANSACTIONS SECTION */}
        <Paper shadow="sm" p="md" withBorder>
          <Stack gap="md">
            <Group>
              <IconShoppingCart size={24} />
              <Title order={3}>Transactions</Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <StatCard
                title="Year to Date"
                value={formatCurrency(metrics.ytdTotal)}
                icon={IconTrendingUp}
                color="blue"
              />
              <StatCard
                title="Month to Date"
                value={formatCurrency(metrics.mtdTotal)}
                icon={IconCurrencyDollar}
                color="green"
              />
              <StatCard
                title="Total Transactions"
                value={metrics.transactionCount.toString()}
                icon={IconShoppingCart}
                color="violet"
              />
            </SimpleGrid>

            {/* Top Products by Monetary Value */}
            {metrics.topProducts.length > 0 && (
              <div>
                <Title order={5} mb="sm">
                  Top 10 Products by Sales Value
                </Title>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rank</Table.Th>
                      <Table.Th>Product Code</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        Total Sales
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        Quantity Sold
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {metrics.topProducts.map((product, index) => (
                      <Table.Tr key={product.productCode}>
                        <Table.Td>{index + 1}</Table.Td>
                        <Table.Td>{product.productCode}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatCurrency(product.totalValue)}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatNumber(product.quantity)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Stack>
        </Paper>

        {/* PRODUCTS SECTION */}
        <Paper shadow="sm" p="md" withBorder>
          <Stack gap="md">
            <Group>
              <IconPackage size={24} />
              <Title order={3}>Products</Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <StatCard
                title="Total COGS"
                value={formatCurrency(metrics.totalCOGS)}
                icon={IconCurrencyDollar}
                color="orange"
              />
              <StatCard
                title="Total Products"
                value={products.length.toString()}
                icon={IconPackage}
                color="cyan"
              />
            </SimpleGrid>
          </Stack>
        </Paper>

        {/* CUSTOMERS SECTION */}
        <Paper shadow="sm" p="md" withBorder>
          <Stack gap="md">
            <Group>
              <IconUsers size={24} />
              <Title order={3}>Customers</Title>
            </Group>

            {metrics.topCustomers.length > 0 && (
              <div>
                <Title order={5} mb="sm">
                  Top 10 Customers by Order Amount
                </Title>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rank</Table.Th>
                      <Table.Th>Customer Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        Total Orders
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        Total Amount
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {metrics.topCustomers.map((customer, index) => (
                      <Table.Tr key={customer.customerName}>
                        <Table.Td>{index + 1}</Table.Td>
                        <Table.Td>{customer.customerName}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {customer.orderCount}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatCurrency(customer.totalAmount)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Stack>
        </Paper>

        {/* SHIPMENTS SECTION */}
        <Paper shadow="sm" p="md" withBorder>
          <Stack gap="md">
            <Group>
              <IconTruck size={24} />
              <Title order={3}>Shipments</Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <StatCard
                title="Total CBM"
                value={formatNumber(metrics.totalCBM)}
                icon={IconCube}
                color="indigo"
              />
              <StatCard
                title="Total Sacks"
                value={metrics.totalSacks.toString()}
                icon={IconPackage}
                color="pink"
              />
              <StatCard
                title="Total Shipments"
                value={shipments.length.toString()}
                icon={IconTruck}
                color="teal"
              />
            </SimpleGrid>
          </Stack>
        </Paper>
      </Stack>
    </PageLayout>
  );
}
