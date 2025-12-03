/**
 * Dispatch Module Type Definitions
 */

export interface DispatchItem {
  id: string;
  orderStatus: string;
  shippingOptions: string;
  username: string;
  customerNames: string;
  messageCustomer: string;
}

export interface RawOrderData {
  'Order ID'?: string;
  'Order Status'?: string;
  'Shipping Option'?: string;
  'Username (Buyer)'?: string;
  'Receiver Name'?: string;
  'Remark from buyer'?: string;
  'Ship Time'?: string | Date;
  'Delivery Address'?: string;
  'Phone Number'?: string;
  City?: string;
  Province?: string;
  'Zip Code'?: string;
  [key: string]: unknown; // Allow other fields from XLSX
}

export interface ServerCustomerData {
  id: number;
  customerName: string;
  businessName: string;
  facebook: string;
  shopeeUsernames: string[];
  address: string;
  phoneNumber: string;
  additionalAddresses: string[];
}

export interface UnmatchedOrder {
  orderId: string;
  username: string;
  deliveryAddress: string;
  receiverName: string;
  phoneNumber: string;
  city: string;
  province: string;
  zipCode: string;
}
