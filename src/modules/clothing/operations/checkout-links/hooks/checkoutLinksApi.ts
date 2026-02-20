import type {
  CheckoutLinkData,
  CustomerOrderData,
  InvoiceData,
} from '../types';
import type { ProductData } from '../../products/types/product.types';

type CustomerOrdersResponse = {
  success?: boolean;
  error?: string;
  orders?: unknown;
};

type CalculateWeightsResponse = {
  success?: boolean;
  error?: string;
  invoices?: InvoiceData[];
  results?: Array<{ unmatchedProducts?: string[] }>;
};

type DataEnvelope<T> = {
  data?: T;
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

export const calculateInvoiceWeights = async (
  apiPath: string
): Promise<{
  invoices: InvoiceData[];
  results: Array<{ unmatchedProducts?: string[] }>;
}> => {
  const response = await fetch(apiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = (await response.json()) as CalculateWeightsResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      result.error || 'Failed to calculate weights. Please retry.'
    );
  }

  return {
    invoices: Array.isArray(result.invoices) ? result.invoices : [],
    results: Array.isArray(result.results) ? result.results : [],
  };
};

export const fetchCheckoutLinksData = async (
  apiPath: string
): Promise<CheckoutLinkData[]> => {
  const response = await fetch(apiPath);
  const result = (await response.json()) as DataEnvelope<CheckoutLinkData[]>;
  return Array.isArray(result.data) ? result.data : [];
};

export const fetchInvoicesData = async (
  apiPath: string
): Promise<InvoiceData[]> => {
  const response = await fetch(apiPath);
  const result = (await response.json()) as DataEnvelope<InvoiceData[]>;
  return Array.isArray(result.data) ? result.data : [];
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
