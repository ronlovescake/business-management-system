import type { CheckoutLinkData, CustomerOrderData } from '../types';
import type { ProductData } from '../../products/types/product.types';

type CustomerOrdersResponse = {
  success?: boolean;
  error?: string;
  orders?: unknown;
};

type DataEnvelope<T> = {
  data?: T;
  success?: boolean;
  error?: string;
};

export const fetchCustomerOrders = async (
  apiPath: string
): Promise<CustomerOrderData[]> => {
  const response = await fetch(apiPath);
  const result = (await response.json()) as CustomerOrdersResponse;

  if (!response.ok || result?.success !== true) {
    throw new Error(
      result?.error || 'Failed to load customer orders. Please retry.'
    );
  }

  return Array.isArray(result.orders)
    ? (result.orders as CustomerOrderData[])
    : [];
};

export const fetchCheckoutLinksData = async (
  apiPath: string
): Promise<CheckoutLinkData[]> => {
  const response = await fetch(apiPath);
  const result = (await response.json()) as DataEnvelope<CheckoutLinkData[]>;
  if (!response.ok || result.success === false || !Array.isArray(result.data)) {
    throw new Error(result.error || 'Failed to load checkout links');
  }
  return result.data;
};

export const fetchProductsData = async (
  apiPath: string
): Promise<ProductData[]> => {
  const response = await fetch(apiPath);

  if (!response.ok) {
    throw new Error('Failed to load product weights');
  }

  const payload = (await response.json()) as
    | ProductData[]
    | { data?: ProductData[] }
    | undefined;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
};
