// ============================================================================
// CUSTOMER DETAILS TYPES
// ============================================================================

export interface CustomerData {
  id: number;
  Date: string;
  'Customer Name': string;
  'Phone Number': string;
  Address: string;
  Facebook: string;
  'Email Address': string;
  'Business Name': string;
  'Tax Number': string;
  'Business Address': string;
  'Business Contact Number': string;
  'Customer Status': string;
}

export interface Order {
  id: number;
  orderDate: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  items: OrderItem[];
  notes?: string;
}

export interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Transaction {
  id: number;
  orderDate: string | null;
  customers: string | null;
  productCode: string | null;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
  adjustment: number | null;
  lineTotal: number | null;
  orderStatus: string | null;
  notes: string | null;
  invoiceDate: string | null;
  packedDate: string | null;
  shipmentCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStats {
  totalTransactions: number;
  totalSpent: number;
  recentTransactions: number;
  cancelledTransactions: number;
  completedTransactions: number;
  completionRate: number;
  cancellationRate: number;
  averageTransactionValue: number;
  totalOrders: number;
  cancelledOrders: number;
  completedOrders: number;
  processingOrders: number;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
