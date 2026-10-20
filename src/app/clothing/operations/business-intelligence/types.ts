export interface TransactionData {
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number | null;
  'Unit Price': number | null;
  Discount: number | null;
  Adjustment: number | null;
  'Line Total': number | null;
  'Order Status': string | null;
  'Invoice Date'?: string | null;
  'Packed Date'?: string | null;
  'Shipment Code'?: string | null;
}

export interface ProductData {
  'Product Code': string;
  Product: string;
  COGS: number;
  'Total CBM': number;
  'No. Of Sacks': number;
  'Posting Date'?: string;
  'Order Date'?: string;
}

export interface ShipmentData {
  id: number;
  'Shipment Code': string;
  'CV Number': string;
  'No. Of Sacks': number;
  'Total CBM': number;
  Weight: number;
  Fee: number | string;
  'Shipment Status': string;
  'Date Created': string;
  'Date Delivered': string;
  Duration: string;
  Notes: string;
}

export interface TopCustomer {
  customerName: string;
  totalAmount: number;
  orderCount: number;
}

export interface TopProduct {
  productCode: string;
  totalValue: number;
  quantity: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  transactions: number;
  topCustomer: string;
  topCustomerRevenue: number;
  topProduct: string;
  topProductRevenue: number;
  shipments: number;
  cbm: number;
  sacks: number;
}

export type { DateFilterType } from '@/lib/analytics/periodComparison';

/** Percent change vs the previous comparable period; null when not comparable. */
export interface KpiDeltas {
  revenue: number | null;
  mtd: number | null;
  transactions: number | null;
  customers: number | null;
  quantity: number | null;
  averageOrderValue: number | null;
}

export interface PeriodTotals {
  revenue: number;
  mtd: number;
  count: number;
  customers: number;
  quantity: number;
}

export interface PipelineStage {
  status: string;
  count: number;
  value: number;
}

export interface CustomerMixMonth {
  month: string;
  newCustomers: number;
  returningCustomers: number;
}

export interface WeekdaySales {
  day: string;
  revenue: number;
  orders: number;
}

export interface ExtendedMetrics {
  uniqueCustomers: number;
  quantitySold: number;
  averageOrderValue: number | null;
  adjustmentsTotal: number;
  lostRevenue: { value: number; count: number };
  notYetInvoiced: { value: number; count: number };
  pipeline: PipelineStage[];
  customerMix: CustomerMixMonth[];
  repeatRate: number | null;
  weekdaySales: WeekdaySales[];
}

export interface ProfitSnapshot {
  revenueTotal: number;
  cogsTotal: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
}
