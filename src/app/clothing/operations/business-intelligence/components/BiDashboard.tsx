'use client';

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
} from '@mantine/core';
import {
  IconCurrencyDollar,
  IconShoppingCart,
  IconTrendingUp,
  IconPackage,
  IconUsers,
  IconCube,
  IconTruck,
} from '@tabler/icons-react';
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
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';
import {
  useBusinessIntelligence,
  filterOptions,
} from '../hooks/useBusinessIntelligence';
import { StatCard } from './StatCard';
import { CHART_COLORS } from '../constants';
import type { DateFilterType } from '../types';

export function BiDashboard() {
  const {
    dateFilter,
    setDateFilter,
    isLoading,
    products,
    shipments,
    metrics,
    formatCurrency,
    formatNumber,
  } = useBusinessIntelligence();

  if (isLoading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
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
          onChange={(value) =>
            setDateFilter((value as DateFilterType) || 'mtd')
          }
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

      {/* Monthly Trends Section */}
      {metrics.monthlyTrends.length > 0 && (
        <>
          <Title order={2} mt="md" mb="sm">
            Monthly Trends
          </Title>

          {/* Revenue & Transaction Trends */}
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Paper shadow="sm" p="lg" withBorder>
              <Title order={3} mb="md">
                Monthly Revenue Trend
              </Title>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={metrics.monthlyTrends}
                  margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    tickFormatter={(value: number) =>
                      `₱${(value / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      formatCurrency(value),
                      'Revenue',
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#228be6"
                    strokeWidth={3}
                    name="Monthly Revenue"
                    dot={{ fill: '#228be6', r: 5 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            <Paper shadow="sm" p="lg" withBorder>
              <Title order={3} mb="md">
                Monthly Transaction Volume
              </Title>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={metrics.monthlyTrends}
                  margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient
                      id="colorTransactions"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#40c057" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#40c057" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="transactions"
                    stroke="#40c057"
                    fillOpacity={1}
                    fill="url(#colorTransactions)"
                    name="Transactions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </SimpleGrid>

          {/* Shipment Trends */}
          <Paper shadow="sm" p="lg" withBorder>
            <Title order={3} mb="md">
              Monthly Shipment Metrics
            </Title>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={metrics.monthlyTrends}
                margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  style={{ fontSize: '12px' }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="right"
                  dataKey="sacks"
                  fill="#fd7e14"
                  name="Total Sacks"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="shipments"
                  stroke="#be4bdb"
                  strokeWidth={2}
                  name="Shipments"
                  dot={{ fill: '#be4bdb', r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cbm"
                  stroke="#4c6ef5"
                  strokeWidth={2}
                  name="Total CBM"
                  dot={{ fill: '#4c6ef5', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Paper>

          {/* Top Performers by Month Table */}
          <Paper shadow="sm" p="lg" withBorder>
            <Title order={3} mb="md">
              Monthly Top Performers
            </Title>
            <div style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Month</Table.Th>
                    <Table.Th>Revenue</Table.Th>
                    <Table.Th>Top Customer</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>
                      Customer Revenue
                    </Table.Th>
                    <Table.Th>Top Product</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>
                      Product Revenue
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {metrics.monthlyTrends.map((month) => (
                    <Table.Tr key={month.month}>
                      <Table.Td>
                        <Text fw={600}>{month.month}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="blue" fw={600}>
                          {formatCurrency(month.revenue)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{month.topCustomer}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="green">
                          {formatCurrency(month.topCustomerRevenue)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{month.topProduct}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="green">
                          {formatCurrency(month.topProductRevenue)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Paper>
        </>
      )}

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
                tickFormatter={(value: number) =>
                  `₱${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Sales']}
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
                formatter={(value: number) => [formatNumber(value), 'Quantity']}
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
                tickFormatter={(value: number) =>
                  `₱${(value / 1000).toFixed(0)}k`
                }
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
                {metrics.topCustomers.slice(0, 5).map((customer, index) => (
                  <Cell
                    key={`cell-${customer.customerName}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
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
                        <Text size="sm">{formatNumber(product.quantity)}</Text>
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
  );
}
