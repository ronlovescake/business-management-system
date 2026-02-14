import type {
  CheckoutLinkData,
  CustomerOrderData,
  InvoiceData,
  ItemWeightData,
} from '../types';

const includesQuery = (fields: Array<string | undefined>, query: string) =>
  fields
    .filter((field): field is string => Boolean(field))
    .some((field) => field.toLowerCase().includes(query));

export const filterCheckoutLinks = (
  checkoutLinks: CheckoutLinkData[],
  searchQuery: string
): CheckoutLinkData[] => {
  if (!searchQuery.trim()) {
    return checkoutLinks;
  }

  const query = searchQuery.toLowerCase();
  return checkoutLinks.filter((item) =>
    includesQuery(
      [
        item.weight,
        item.width,
        item.length,
        item.height,
        item.checkoutLinks,
        item.productPortals,
        item.productNames,
      ],
      query
    )
  );
};

export const filterInvoiceData = (
  invoiceData: InvoiceData[],
  searchQuery: string
): InvoiceData[] => {
  if (!searchQuery.trim()) {
    return invoiceData;
  }

  const query = searchQuery.toLowerCase();
  return invoiceData.filter((item) =>
    includesQuery(
      [
        item.customerName,
        item.actualWeight,
        item.finalWeight,
        item.shopeeCheckoutLinks,
        item.driveFiles,
        item.message,
        item.chat,
      ],
      query
    )
  );
};

export const filterItemWeightData = (
  itemWeightData: ItemWeightData[],
  searchQuery: string
): ItemWeightData[] => {
  if (!searchQuery.trim()) {
    return itemWeightData;
  }

  const query = searchQuery.toLowerCase();
  return itemWeightData.filter((item) =>
    includesQuery(
      [
        item.itemName,
        item.productCode ?? '',
        item.bulkQuantity,
        item.bulkWeight,
        item.approxWeightPerPiece,
      ],
      query
    )
  );
};

export const filterCustomerOrders = (
  customerOrders: CustomerOrderData[],
  searchQuery: string
): CustomerOrderData[] => {
  if (!searchQuery.trim()) {
    return customerOrders;
  }

  const query = searchQuery.toLowerCase();
  return customerOrders.filter((order) =>
    includesQuery(
      [
        order.customerName,
        order.productCode,
        order.orderStatus,
        order.actualWeight,
        order.weightPerPiece,
        order.quantity.toString(),
      ],
      query
    )
  );
};

export const filterLocalInvoiceData = (
  localInvoiceData: InvoiceData[],
  searchQuery: string,
  selectedDate: string | null
): InvoiceData[] => {
  const matchesSelectedDate = (item: InvoiceData) => {
    if (!selectedDate) {
      return true;
    }

    const invoiceDates = item.localInvoiceDates
      ? item.localInvoiceDates
      : item.localInvoiceDate
        ? [item.localInvoiceDate]
        : [];

    return invoiceDates.includes(selectedDate);
  };

  if (!searchQuery.trim()) {
    return localInvoiceData.filter(matchesSelectedDate);
  }

  const query = searchQuery.toLowerCase();
  return localInvoiceData.filter((item) => {
    const matchesSearch = includesQuery(
      [item.customerName, item.driveFiles],
      query
    );

    return matchesSearch && matchesSelectedDate(item);
  });
};
