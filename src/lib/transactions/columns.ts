import type { HandsontableColumn } from '@/components/ui/HandsontableGrid';
import type {
  ColumnIdToKey,
  TransactionData,
} from '@/modules/clothing/operations/transactions/types/transaction.types';
import type { ReadOnlyColumnFlags } from './constants';

interface BuildTransactionColumnsParams {
  customerNames: TransactionData['Customers'][];
  productCodes: TransactionData['Product Code'][];
  readOnlyColumns: ReadOnlyColumnFlags;
  statusDropdownOptions: string[];
}

export const buildTransactionColumns = ({
  customerNames,
  productCodes,
  readOnlyColumns,
  statusDropdownOptions,
}: BuildTransactionColumnsParams): HandsontableColumn[] => [
  {
    title: 'ORDER DATE',
    width: 140,
    id: 'orderDate',
    align: 'center',
  },
  {
    title: 'CUSTOMERS',
    width: 500,
    id: 'customers',
    type: 'dropdown',
    dropdownValues: customerNames,
    dropdownSearchMode: 'contains',
  },
  {
    title: 'PRODUCT CODE',
    width: 550,
    id: 'productCode',
    type: 'dropdown',
    dropdownValues: productCodes,
  },
  {
    title: 'QUANTITY',
    width: 140,
    id: 'quantity',
    type: 'numeric',
    align: 'center',
  },
  {
    title: 'UNIT PRICE',
    width: 140,
    id: 'unitPrice',
    type: 'numeric',
    align: 'right',
    readOnly: readOnlyColumns.unitPrice,
    numericFormat: '0,0.00',
  },
  {
    title: 'DISCOUNT',
    width: 140,
    id: 'discount',
    type: 'numeric',
    align: 'right',
    numericFormat: '0,0.00',
  },
  {
    title: 'ADJUSTMENT',
    width: 140,
    id: 'adjustment',
    type: 'numeric',
    align: 'right',
    readOnly: true,
    numericFormat: '0,0.00',
  },
  {
    title: 'LINE TOTAL',
    width: 140,
    id: 'lineTotal',
    type: 'numeric',
    align: 'right',
    readOnly: readOnlyColumns.lineTotal,
    numericFormat: '0,0.00',
  },
  {
    title: 'ORDER STATUS',
    width: 160,
    id: 'orderStatus',
    type: 'dropdown',
    dropdownValues: statusDropdownOptions,
    align: 'center',
  },
  {
    title: 'NOTES',
    width: 280,
    id: 'notes',
    className: 'ht-truncate',
  },
  {
    title: 'INVOICE DATE',
    width: 160,
    id: 'invoiceDate',
    align: 'center',
    readOnly: readOnlyColumns.invoiceDate,
  },
  {
    title: 'PACKED DATE',
    width: 160,
    id: 'packedDate',
    align: 'center',
    readOnly: readOnlyColumns.packedDate,
  },
  {
    title: 'SHIPMENT CODE',
    width: 160,
    id: 'shipmentCode',
    align: 'center',
    readOnly: readOnlyColumns.shipmentCode,
  },
];

export const buildColumnIdToKey = (): ColumnIdToKey => ({
  orderDate: 'Order Date',
  customers: 'Customers',
  productCode: 'Product Code',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  discount: 'Discount',
  adjustment: 'Adjustment',
  lineTotal: 'Line Total',
  orderStatus: 'Order Status',
  notes: 'Notes',
  invoiceDate: 'Invoice Date',
  packedDate: 'Packed Date',
  shipmentCode: 'Shipment Code',
});

export const buildPackingListColumns = (
  columns: HandsontableColumn[]
): HandsontableColumn[] =>
  columns.map((column) => ({ ...column, readOnly: true }));

export const buildDueDateColumns = (): HandsontableColumn[] => [
  {
    title: 'CUSTOMER',
    width: 500,
    id: 'customer',
    readOnly: true,
  },
  {
    title: 'PRODUCT CODE',
    width: 500,
    id: 'productCode',
    readOnly: true,
  },
  {
    title: 'QUANTITY',
    width: 120,
    id: 'quantity',
    type: 'numeric',
    align: 'center',
    readOnly: true,
  },
  {
    title: 'UNIT PRICE',
    width: 140,
    id: 'unitPrice',
    type: 'numeric',
    align: 'right',
    readOnly: true,
  },
  {
    title: 'LINE TOTAL',
    width: 160,
    id: 'lineTotal',
    type: 'numeric',
    align: 'right',
    readOnly: true,
  },
  {
    title: 'INVOICE DATE',
    width: 160,
    id: 'invoiceDate',
    align: 'center',
    readOnly: true,
  },
  {
    title: 'DUE DATE',
    width: 160,
    id: 'dueDate',
    align: 'center',
    readOnly: true,
  },
  {
    title: 'DUE IN',
    width: 200,
    id: 'dueIn',
    align: 'center',
    readOnly: true,
  },
  {
    title: 'NOTES',
    width: 360,
    id: 'notes',
    className: 'ht-truncate',
    readOnly: true,
  },
  {
    title: 'DONE',
    width: 120,
    id: 'done',
    align: 'center',
    readOnly: true,
  },
];

export const buildRecentlyUpdatedColumns = (
  columns: HandsontableColumn[]
): HandsontableColumn[] => {
  const clonedColumns = columns.map((column) => ({
    ...column,
    readOnly: true,
  }));
  const shipmentIndex = clonedColumns.findIndex(
    (column) => column.id === 'shipmentCode'
  );
  const updatedColumn: HandsontableColumn = {
    title: 'DATE/TIME UPDATED',
    width: 220,
    id: 'updatedAt',
    align: 'center',
    readOnly: true,
  };

  if (shipmentIndex === -1) {
    return [...clonedColumns, updatedColumn];
  }

  return [
    ...clonedColumns.slice(0, shipmentIndex + 1),
    updatedColumn,
    ...clonedColumns.slice(shipmentIndex + 1),
  ];
};
