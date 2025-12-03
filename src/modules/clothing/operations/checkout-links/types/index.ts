/**
 * Shared types for the Checkout Links module UI
 */

export interface CheckoutLinkData {
  id: string;
  weight: string;
  width: string;
  length: string;
  height: string;
  checkoutLinks: string;
  productPortals: string;
  productNames: string;
}

export interface InvoiceData {
  id: string;
  customerName: string;
  actualWeight: string;
  finalWeight: string;
  shopeeCheckoutLinks: string;
  driveFiles: string;
  message: string;
  chat: string;
  tickbox: boolean;
}

export interface ItemWeightData {
  id: string;
  itemName: string;
  productCode?: string;
  bulkQuantity: string;
  bulkWeight: string;
  approxWeightPerPiece: string;
}

export type CheckoutLinkFormValues = {
  weight: string;
  width: string;
  length: string;
  height: string;
  checkoutLinks: string;
  productPortals: string;
  productNames: string;
};
