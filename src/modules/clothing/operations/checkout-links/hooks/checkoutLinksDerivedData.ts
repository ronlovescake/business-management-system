import type { CustomerOrderData, InvoiceData } from '../types';
import type { TransactionData } from '../../transactions/types/transaction.types';

export const buildInvoiceWeightsByCustomer = (invoiceData: InvoiceData[]) => {
  const map = new Map<string, string>();

  invoiceData.forEach((invoice) => {
    const customerName = invoice.customerName?.trim().toLowerCase();
    if (!customerName) {
      return;
    }

    if (!invoice.actualWeight) {
      return;
    }

    if (!map.has(customerName)) {
      map.set(customerName, invoice.actualWeight);
    }
  });

  return map;
};

export const buildCustomerOrderWeightsByCustomer = (
  customerOrders: CustomerOrderData[]
) => {
  const map = new Map<string, number>();

  customerOrders.forEach((order) => {
    const key = order.customerName?.trim().toLowerCase();
    if (!key) {
      return;
    }

    const weight = Number(order.actualWeight);
    if (!Number.isFinite(weight)) {
      return;
    }

    map.set(key, (map.get(key) ?? 0) + weight);
  });

  return map;
};

type BuildLocalInvoiceDataArgs = {
  transactionsWithInvoiceDate: TransactionData[];
  localInvoiceTickboxes: Record<string, boolean>;
  invoiceWeightsByCustomer: Map<string, string>;
  customerOrderWeightsByCustomer: Map<string, number>;
};

export const buildLocalInvoiceData = ({
  transactionsWithInvoiceDate,
  localInvoiceTickboxes,
  invoiceWeightsByCustomer,
  customerOrderWeightsByCustomer,
}: BuildLocalInvoiceDataArgs): InvoiceData[] => {
  if (transactionsWithInvoiceDate.length === 0) {
    return [];
  }

  const collator = new Intl.Collator(undefined, {
    sensitivity: 'base',
    ignorePunctuation: true,
  });

  const byCustomer = new Map<string, InvoiceData>();

  transactionsWithInvoiceDate.forEach((transaction) => {
    const invoiceDate = transaction['Invoice Date']?.trim();
    const customerName = transaction.Customers?.trim();

    if (!invoiceDate || !customerName) {
      return;
    }

    const key = customerName.toLowerCase();
    const derivedOrderWeight = customerOrderWeightsByCustomer.get(key);
    const invoiceActualWeight = invoiceWeightsByCustomer.get(key);
    const existing = byCustomer.get(key);
    const recordId = existing?.id ?? `local-${transaction.id ?? key}`;
    const isChecked = Boolean(localInvoiceTickboxes[recordId]);

    if (existing) {
      const existingDates = new Set(
        existing.localInvoiceDates ??
          (existing.localInvoiceDate ? [existing.localInvoiceDate] : [])
      );

      if (!existingDates.has(invoiceDate)) {
        existingDates.add(invoiceDate);
        existing.localInvoiceDates = Array.from(existingDates);
      }

      if (derivedOrderWeight !== undefined) {
        existing.actualWeight = derivedOrderWeight.toFixed(2);
      } else if (invoiceActualWeight) {
        existing.actualWeight = invoiceActualWeight;
      }
      existing.tickbox = isChecked;
      return;
    }

    const resolvedActualWeight = (() => {
      if (derivedOrderWeight !== undefined) {
        return derivedOrderWeight.toFixed(2);
      }
      if (invoiceActualWeight) {
        return invoiceActualWeight;
      }
      return '';
    })();

    byCustomer.set(key, {
      id: recordId,
      customerName,
      actualWeight: resolvedActualWeight,
      finalWeight: '',
      shopeeCheckoutLinks: '',
      driveFiles: invoiceDate,
      message: '',
      chat: '',
      tickbox: isChecked,
      localInvoiceDate: invoiceDate,
      localInvoiceDates: [invoiceDate],
    });
  });

  return Array.from(byCustomer.values()).sort((a, b) =>
    collator.compare(a.customerName, b.customerName)
  );
};

export const buildLocalInvoiceDateOptions = (
  transactionsWithInvoiceDate: TransactionData[]
) => {
  const uniqueDates = Array.from(
    new Set(
      transactionsWithInvoiceDate
        .map((transaction) => transaction['Invoice Date']?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  return uniqueDates.sort((a, b) => {
    const dateA = Date.parse(a);
    const dateB = Date.parse(b);
    if (Number.isNaN(dateA) || Number.isNaN(dateB)) {
      return a.localeCompare(b);
    }
    return dateB - dateA;
  });
};
