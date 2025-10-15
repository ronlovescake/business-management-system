import { http, HttpResponse } from 'msw';

const baseUrl = 'http://localhost/api/transactions';

const sampleTransactions = [
  {
    id: 1,
    'Order Date': 'Jan 15, 2025',
    Customers: 'Alpha Retail',
    'Product Code': 'SKU-100',
    Quantity: 5,
    'Unit Price': 240,
    Discount: 10,
    Adjustment: 0,
    'Line Total': 1200,
    'Order Status': 'In Transit',
    Notes: 'Priority customer',
    'Invoice Date': 'Jan 16, 2025',
    'Packed Date': '',
    'Shipment Code': 'SHIP-001',
  },
];

export const transactionsHandlers = [
  http.get(baseUrl, () => {
    return HttpResponse.json(sampleTransactions, { status: 200 });
  }),
  http.post(baseUrl, async ({ request }) => {
    const body = (await request.json()) as unknown[];
    return HttpResponse.json(
      {
        message: `Imported ${body.length} transactions`,
        count: body.length,
      },
      { status: 200 }
    );
  }),
  http.patch(baseUrl, () => {
    return HttpResponse.json(
      { message: 'Transaction updated successfully' },
      { status: 200 }
    );
  }),
  http.put(baseUrl, async ({ request }) => {
    const body = (await request.json()) as unknown[];
    return HttpResponse.json(
      {
        message: `Updated ${body.length} transactions`,
        count: body.length,
      },
      { status: 200 }
    );
  }),
];
