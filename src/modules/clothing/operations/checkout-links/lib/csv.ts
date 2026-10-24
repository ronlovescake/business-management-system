import Papa from 'papaparse';
import type { CheckoutLinkData } from '../types';

type CheckoutLinkCsvRow = Omit<CheckoutLinkData, 'id'>;
const columns: Array<{ key: keyof CheckoutLinkCsvRow; header: string }> = [
  { key: 'weight', header: 'WEIGHT' },
  { key: 'width', header: 'WIDTH' },
  { key: 'length', header: 'LENGTH' },
  { key: 'height', header: 'HEIGHT' },
  { key: 'checkoutLinks', header: 'CHECKOUT LINKS' },
  { key: 'productPortals', header: 'PRODUCT PORTALS' },
  { key: 'productNames', header: 'PRODUCT NAMES' },
];
const normalizeHeader = (header: string) =>
  header
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();

export function parseCheckoutLinksCsv(text: string): CheckoutLinkCsvRow[] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (result.errors.length > 0 || result.data.length < 2) {
    throw new Error('CSV file is empty or malformed');
  }
  const headers = result.data[0].map(normalizeHeader);
  const indexes = columns.map((column) =>
    headers.indexOf(normalizeHeader(column.header))
  );
  if (
    indexes.some((index) => index < 0) ||
    new Set(headers).size !== headers.length
  ) {
    throw new Error(
      `Invalid CSV headers. Expected: ${columns.map((column) => column.header).join(', ')}`
    );
  }
  return result.data.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has an incorrect number of fields`
      );
    }
    const row = Object.fromEntries(
      columns.map((column, index) => [column.key, values[indexes[index]]])
    ) as CheckoutLinkCsvRow;
    if (
      [row.weight, row.width, row.length, row.height].some(
        (value) => !value.trim()
      )
    ) {
      throw new Error(
        `CSV row ${rowIndex + 2} requires weight, width, length and height`
      );
    }
    return row;
  });
}

export function serializeCheckoutLinksCsv(rows: CheckoutLinkCsvRow[]): string {
  return Papa.unparse({
    fields: columns.map((column) => column.header),
    data: rows.map((row) => columns.map((column) => row[column.key])),
  });
}
