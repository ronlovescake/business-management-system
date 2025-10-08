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
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

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
// CHART COLORS
// ============================================================================

const COLORS = [
  '#228be6',
  '#40c057',
  '#fd7e14',
  '#be4bdb',
  '#fab005',
  '#15aabf',
  '#e64980',
  '#7950f2',
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
    <PageLayout title="Business Intelligence" size="100%" fluid>
      <Stack gap="lg">
        {/* Header with Filter */}
        <Group justify="space-between" align="center" wrap="nowrap">
          <div>
            <Title order={1} size="h2" mb={4}>
              Business Intelligence Dashboard
            </Title>
            <Text size="sm" c="dimmed">
              Real-time business metrics and analytics
            </Text>
          </div>
          <Select
            data={filterOptions}
            value={dateFilter}
            onChange={(value) => setDateFilter(value || 'mtd')}
            w={220}
            size="md"
            placeholder="Select time period"
            label="Time Period"
            styles={{
              label: { fontWeight: 600 },
            }}
          />
        </Group>

        {/* Key Metrics Row */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }} spacing="md">
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
            title="Transactions"
            value={metrics.transactionCount.toString()}
            icon={IconShoppingCart}
            color="violet"
          />
          <StatCard
            title="Total COGS"
            value={formatCurrency(metrics.totalCOGS)}
            icon={IconPackage}
            color="orange"
          />
          <StatCard
            title="Total CBM"
            value={formatNumber(metrics.totalCBM)}
            icon={IconCube}
            color="indigo"
          />
          <StatCard
            title="Total Sacks"
            value={metrics.totalSacks.toString()}
            icon={IconTruck}
            color="pink"
          />
        </SimpleGrid>

        {/* Charts Row 1 - Sales & Products */}
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          {/* Top Products Bar Chart */}
          <Paper shadow="sm" p="lg" withBorder>
            <Title order={3} mb="md">
              Top 10 Products by Sales Value
            </Title>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={metrics.topProducts}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="productCode"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    'Sales',
                  ]}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Bar
                  dataKey="totalValue"
                  fill="#228be6"
                  name="Total Sales"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          {/* Top Products Quantity Line Chart */}
          <Paper shadow="sm" p="lg" withBorder>
            <Title order={3} mb="md">
              Product Quantity Sold
            </Title>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart
                data={metrics.topProducts}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <defs>
                  <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="productCode"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  style={{ fontSize: '12px' }}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [
                    formatNumber(value),
                    'Quantity',
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="quantity"
                  stroke="#8884d8"
                  fillOpacity={1}
                  fill="url(#colorQty)"
                  name="Quantity Sold"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </SimpleGrid>

        {/* Charts Row 2 - Customers & Revenue Distribution */}
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          {/* Top Customers Bar Chart */}
          <Paper shadow="sm" p="lg" withBorder>
            <Title order={3} mb="md">
              Top 10 Customers by Revenue
            </Title>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={metrics.topCustomers}
                margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="customerName"
                  type="category"
                  width={150}
                  style={{ fontSize: '11px' }}
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    'Revenue',
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="totalAmount"
                  fill="#40c057"
                  name="Total Revenue"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          {/* Customer Order Distribution */}
          <Paper shadow="sm" p="lg" withBorder>
            <Title order={3} mb="md">
              Customer Order Distribution (Top 5)
            </Title>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={metrics.topCustomers.slice(0, 5).map((c) => ({
                    name: c.customerName,
                    value: c.totalAmount,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label
                >
                  {metrics.topCustomers.slice(0, 5).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    'Revenue',
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </SimpleGrid>

        {/* Detailed Tables Section */}
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          {/* Products Table */}
          <Paper shadow="sm" p="lg" withBorder>
            <Group mb="md">
              <IconPackage size={24} color="#fd7e14" />
              <Title order={3}>Products Overview</Title>
            </Group>

            {metrics.topProducts.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Product Code</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Sales</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Qty</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {metrics.topProducts.map((product, index) => (
                      <Table.Tr key={product.productCode}>
                        <Table.Td>
                          <Text fw={600} c="blue">
                            {index + 1}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {product.productCode}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="green" fw={600}>
                            {formatCurrency(product.totalValue)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {formatNumber(product.quantity)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}

            <Group mt="md" justify="space-between">
              <StatCard
                title="Total Products"
                value={products.length.toString()}
                icon={IconPackage}
                color="cyan"
              />
              <StatCard
                title="Total COGS"
                value={formatCurrency(metrics.totalCOGS)}
                icon={IconCurrencyDollar}
                color="orange"
              />
            </Group>
          </Paper>

          {/* Customers Table */}
          <Paper shadow="sm" p="lg" withBorder>
            <Group mb="md">
              <IconUsers size={24} color="#228be6" />
              <Title order={3}>Customers Overview</Title>
            </Group>

            {metrics.topCustomers.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Customer Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Orders</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {metrics.topCustomers.map((customer, index) => (
                      <Table.Tr key={customer.customerName}>
                        <Table.Td>
                          <Text fw={600} c="blue">
                            {index + 1}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {customer.customerName}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">{customer.orderCount}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="green" fw={600}>
                            {formatCurrency(customer.totalAmount)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>
        </SimpleGrid>

        {/* Shipments Section */}
        <Paper shadow="sm" p="lg" withBorder>
          <Group mb="md">
            <IconTruck size={24} color="#be4bdb" />
            <Title order={3}>Shipments Overview</Title>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
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
        </Paper>
      </Stack>
    </PageLayout>
  );
}
