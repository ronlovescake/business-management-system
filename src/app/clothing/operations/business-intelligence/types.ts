export interface TransactionData {
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

export type DateFilterType =
  | 'ytd'
  | 'mtd'
  | 'last7days'
  | 'last30days'
  | 'last3months'
  | 'last6months'
  | 'all';
