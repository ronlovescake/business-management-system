export function getDirectCustomerSearch(question: string): string | null {
  const match =
    /^how many orders (?:does|has) ([\p{L}\p{M}][\p{L}\p{M} .'-]{1,100}?) (?:have|has)[?.!]*$/iu.exec(
      question.trim()
    );
  const search = match?.[1].trim() ?? null;
  return search &&
    !/^(?:she|he|they|it|them|this customer|that customer)$/i.test(search)
    ? search
    : null;
}

function cell(value: unknown): string {
  return String(value ?? 'Not recorded')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\`*_\[\]])/g, '\\$1');
}

export function formatCustomerOrders(output: unknown): string | null {
  const data = output as {
    customersByOrderHistory?: Array<{
      customerId: number | null;
      customerName: string;
      totalOrders: number;
    }>;
    registeredCustomersFromDirectory?: Array<{ id: number }>;
    matchingTransactions?: Array<{
      transactionId: number;
      customerId: number;
      orderDate: string | null;
      product?: string | null;
      productCode: string;
      quantity: number;
      orderStatus: string;
    }>;
    matchingTransactionCount?: number;
    returnedTransactionCount?: number;
    hasMoreTransactions?: boolean;
  } | null;
  const customers = data?.customersByOrderHistory;
  const rows = data?.matchingTransactions;
  if (!customers || customers.length !== 1 || !rows?.length) {
    return null;
  }
  const customer = customers[0];
  if (
    !customer.customerId ||
    rows.some((row) => row.customerId !== customer.customerId) ||
    data?.registeredCustomersFromDirectory?.some(
      (entry) => entry.id !== customer.customerId
    ) ||
    data?.matchingTransactionCount !== customer.totalOrders ||
    data.returnedTransactionCount !== rows.length ||
    data.hasMoreTransactions !== rows.length < customer.totalOrders
  ) {
    return null;
  }

  const commonStatus =
    rows.length === customer.totalOrders &&
    rows.every(
      (row) => row.orderStatus && row.orderStatus === rows[0].orderStatus
    );
  const heading = `**${cell(customer.customerName)}** has **${customer.totalOrders} order records**.`;
  const completeness = data.hasMoreTransactions
    ? `Showing ${rows.length} of ${customer.totalOrders} records; this is not the complete history.`
    : `Here are all ${rows.length} records${commonStatus ? `; every one is marked **${cell(rows[0].orderStatus)}**` : ''}:`;
  const table = [
    `| Date | Product | Qty |${commonStatus ? '' : ' Status |'}`,
    `| --- | --- | ---: |${commonStatus ? '' : ' --- |'}`,
    ...rows.map(
      (row) =>
        `| ${cell(row.orderDate)} | ${cell(row.product ?? row.productCode)}${row.product ? ` (${cell(row.productCode)})` : ''} | ${cell(row.quantity)} |${commonStatus ? '' : ` ${cell(row.orderStatus)} |`}`
    ),
  ];
  return [
    heading,
    completeness,
    table.join('\n'),
    '[View customer records](/clothing/operations/customers).',
  ].join('\n\n');
}
