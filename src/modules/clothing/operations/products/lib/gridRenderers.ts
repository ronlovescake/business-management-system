import type { ProductData } from '../types/product.types';

type HandsontableGlobal = typeof window & {
  Handsontable?: {
    renderers?: {
      TextRenderer?: (
        instance: unknown,
        td: HTMLTableCellElement,
        row: number,
        col: number,
        prop: string | number,
        value: unknown,
        cellProperties: unknown
      ) => void;
    };
  };
};

export const PRODUCT_COLUMN_KEYS: (keyof ProductData)[] = [
  'Shipment Code',
  'CV Number',
  'No. Of Sacks',
  'Total CBM',
  'Weight',
  'Shipment Status',
  'Posting Date',
  'Order Date',
  'Payment',
  'Product',
  'Product Code',
  'Age Range',
  'Unit',
  'Unit Price',
  'Quantity',
  'Alibaba Shipping Cost',
  'Exchange Rates',
  'PHP',
  'Sub Total (PHP)',
  'Transaction Fee',
  'Grand Total',
  "Forwarder's Fee",
  'Lalamove',
  'Packaging Cost',
  'Suggested Price',
  'Actual Price',
  'Landed Unit Cost',
  'COGS',
  'Projected Sales',
  'Projected Profit',
  'Projected Profit (%)',
  'Total Markup',
  'Link To Post',
  'Bulk Quantity',
  'Bulk Weight',
  'Weight Per Piece',
];

export const displayOptionalNumber = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '';
  }

  return value === 0 ? '' : value;
};

const getHandsontableTextRenderer = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    (window as HandsontableGlobal).Handsontable?.renderers?.TextRenderer ?? null
  );
};

export const clippedTextRenderer = (
  instance: unknown,
  td: HTMLTableCellElement,
  row: number,
  col: number,
  prop: string | number,
  value: unknown,
  cellProperties: unknown
) => {
  const textRenderer = getHandsontableTextRenderer();
  if (textRenderer) {
    textRenderer(instance, td, row, col, prop, value, cellProperties);
  } else {
    td.textContent = value !== null && value !== undefined ? String(value) : '';
  }

  td.style.whiteSpace = 'nowrap';
  td.style.textOverflow = 'ellipsis';
  td.style.overflow = 'hidden';
};
