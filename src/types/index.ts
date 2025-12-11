// ===========================
// BUSINESS DOMAIN TYPES
// ===========================

export interface Business {
  id: string;
  name: string;
  type: 'clothing' | 'trucking';
}

export interface Workspace {
  id: string;
  name: string;
  businessId: string;
  type: 'operations' | 'employees' | 'expenses';
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
}

// ===========================
// DATA TRANSFER OBJECTS (DTOs)
// ===========================

export interface CustomerDTO {
  id?: number;
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

export interface ProductDTO {
  id?: number;
  'Shipment Code': string;
  'CV Number': string;
  Product: string;
  'Product Code': string;
  'Order Date': string;
  'Posting Date': string;
  'Unit Price': number;
  Quantity: number;
  'Suggested Price': number;
  'Actual Price': number;
  COGS: number;
  'Projected Sales': number;
  'Projected Profit': number;
  'Projected Profit (%)': number;
  'Shipment Status': string;
  'Link To Post'?: string;
  'Bulk Quantity'?: number;
  'Bulk Weight'?: number;
  'Weight Per Piece'?: number;
  [key: string]: string | number | undefined;
}

export interface TransactionDTO {
  id?: number;
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number;
  'Unit Price': number;
  Discount: number;
  Adjustment: number;
  'Line Total': number;
  'Order Status': string;
  Notes: string;
  'Invoice Date': string;
  'Packed Date': string;
  'Shipment Code': string;
}

export interface ShipmentDTO {
  id?: number;
  'Shipment Code': string;
  'CV Number': string;
  'No. Of Sacks': number;
  'Total CBM': number;
  Weight: number;
  Fee: number;
  'Shipment Status': string;
  'Date Created': string;
  'Date Delivered': string;
  Duration: string;
  Notes: string;
}

export interface PriceDTO {
  id?: number;
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
  'Price Adjustment': number;
}

export interface ExpenseDTO {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string | null;
  receipt: string | null;
  status: string;
  employeeName: string | null;
  vehicleId?: string | null;
}

// Legacy support
export interface ShipmentData extends ShipmentDTO {}

// ===========================
// DATABASE MODEL INTERFACES
// ===========================

export interface ShipmentDB {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  shipmentCode: string;
  cvNumber: string | null;
  noOfSacks: number;
  totalCBM: number;
  weight: number;
  fee: number;
  shipmentStatus: string;
  dateCreated: string | null;
  dateDelivered: string | null;
  duration: string | null;
  notes: string | null;
}

// ===========================
// SHEET CONFIGURATION TYPES
// ===========================

export interface SheetColumn {
  id: string;
  title: string;
  width?: number;
  grow?: number;
  hasMenu?: boolean;
  themeOverride?: object;
}

export interface SheetConfig<T = unknown> {
  id: string;
  title: string;
  endpoint: string;
  columns: SheetColumn[];
  searchFields: (keyof T)[];
  features?: {
    search?: boolean;
    export?: boolean;
    import?: boolean;
    bulkEdit?: boolean;
    create?: boolean;
    delete?: boolean;
  };
  renderer?: 'glide' | 'univer' | 'table';
}

// ===========================
// API RESPONSE TYPES
// ===========================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ===========================
// SERVICE TYPES
// ===========================

export type DataSourceType =
  | 'customers'
  | 'products'
  | 'transactions'
  | 'shipments'
  | 'prices';

export interface ServiceOptions {
  cache?: boolean;
  timeout?: number;
  retries?: number;
}
