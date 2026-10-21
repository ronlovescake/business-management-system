import { useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  GridCellKind,
  type GridCell,
  type GridColumn,
  type Item,
  type DataEditorProps,
} from '@glideapps/glide-data-grid';
import type { CustomerData } from '../types/customer.types';
import { useBusinessStore } from '@/lib/store';
import { buildWorkspacePath } from '@/lib/routes';

interface UseCustomersGridProps {
  filteredCustomers: CustomerData[];
  visibleColumnIds?: readonly string[];
  directoryView?: boolean;
}

const spreadsheetColumns: GridColumn[] = [
  { title: 'Date', width: 160, id: 'date' },
  { title: 'Customer Name', width: 500, id: 'customerName' },
  { title: 'Phone Number', width: 190, id: 'phoneNumber' },
  { title: 'Address', width: 340, id: 'address' },
  { title: 'Facebook', width: 220, id: 'facebook' },
  { title: 'Email Address', width: 260, id: 'emailAddress' },
  { title: 'Business Name', width: 500, id: 'businessName' },
  { title: 'Tax Number', width: 170, id: 'taxNumber' },
  { title: 'Business Address', width: 340, id: 'businessAddress' },
  { title: 'Business Contact Number', width: 260, id: 'businessContactNumber' },
  { title: 'Customer Status', width: 120, id: 'customerStatus', grow: 1 },
];

export const customerColumns: GridColumn[] = [
  // `grow` shares spare width so the visible columns always fill the table.
  { title: 'Customer Name', width: 260, id: 'customerName', grow: 1 },
  { title: 'Phone Number', width: 160, id: 'phoneNumber' },
  { title: 'Email Address', width: 230, id: 'emailAddress', grow: 1 },
  { title: 'Address', width: 300, id: 'address', grow: 3 },
  { title: 'Customer Status', width: 140, id: 'customerStatus' },
  { title: 'Date', width: 140, id: 'date' },
  { title: 'Facebook', width: 240, id: 'facebook', grow: 1 },
  { title: 'Business Name', width: 260, id: 'businessName', grow: 1 },
  { title: 'Tax Number', width: 160, id: 'taxNumber' },
  { title: 'Business Address', width: 300, id: 'businessAddress', grow: 2 },
  { title: 'Business Contact Number', width: 220, id: 'businessContactNumber' },
];

export const defaultCustomerColumnIds = [
  'customerName',
  'phoneNumber',
  'emailAddress',
  'address',
  'customerStatus',
] as const;

export function useCustomersGrid({
  filteredCustomers,
  visibleColumnIds = defaultCustomerColumnIds,
  directoryView = true,
}: UseCustomersGridProps) {
  const router = useRouter();
  const { selectedBusiness } = useBusinessStore();
  const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);

  // Customer columns
  const columns: GridColumn[] = useMemo(
    () =>
      directoryView
        ? customerColumns.filter(
            (column) =>
              column.id === 'customerName' ||
              visibleColumnIds.includes(column.id ?? '')
          )
        : spreadsheetColumns,
    [directoryView, visibleColumnIds]
  );

  // Data rendering for grid
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      if (row < 0 || row >= filteredCustomers.length || !columns[col]) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
          readonly: true,
        } as GridCell;
      }

      const customer = filteredCustomers[row];
      const column = columns[col];

      let rawValue: unknown = '';
      switch (column.id) {
        case 'date':
          rawValue = customer.Date;
          break;
        case 'customerName':
          rawValue = customer['Customer Name'];
          break;
        case 'phoneNumber':
          rawValue = customer['Phone Number'];
          break;
        case 'address':
          rawValue = customer.Address;
          break;
        case 'facebook':
          rawValue = customer.Facebook;
          break;
        case 'emailAddress':
          rawValue = customer['Email Address'];
          break;
        case 'businessName':
          rawValue = customer['Business Name'];
          break;
        case 'taxNumber':
          rawValue = customer['Tax Number'];
          break;
        case 'businessAddress':
          rawValue = customer['Business Address'];
          break;
        case 'businessContactNumber':
          rawValue = customer['Business Contact Number'];
          break;
        case 'customerStatus':
          rawValue = customer['Customer Status'];
          break;
        default:
          rawValue = '';
      }

      const cellData =
        rawValue === null || rawValue === undefined ? '' : String(rawValue);

      // Make customer name column appear as a clickable link
      if (column.id === 'customerName' && cellData && customer.id) {
        return {
          kind: GridCellKind.Text,
          data: cellData,
          displayData: cellData,
          allowOverlay: false,
          readonly: true,
          contentAlign: 'left',
          cursor: directoryView ? 'pointer' : undefined,
          themeOverride: directoryView
            ? { textDark: '#1864ab', baseFontStyle: '600 14px' }
            : undefined,
        } as GridCell;
      }

      return {
        kind: GridCellKind.Text,
        data: cellData,
        displayData: cellData,
        allowOverlay: false,
        readonly: true,
        themeOverride: directoryView ? { textDark: '#59636e' } : undefined,
      };
    },
    [filteredCustomers, columns, directoryView]
  );

  const getRowCount = useCallback(
    () => filteredCustomers.length,
    [filteredCustomers]
  );

  const drawCell = useCallback<NonNullable<DataEditorProps['drawCell']>>(
    ({ ctx, cell, col, rect, theme }, drawContent) => {
      if (
        columns[col]?.id !== 'customerStatus' ||
        cell.kind !== GridCellKind.Text
      ) {
        drawContent();
        return;
      }

      const colors: Record<string, { background: string; foreground: string }> =
        {
          active: { background: '#e6f4ec', foreground: '#216e43' },
          inactive: { background: '#f1f3f5', foreground: '#59636e' },
          prospect: { background: '#e7f1fb', foreground: '#1864ab' },
          vip: { background: '#fff3d6', foreground: '#805b10' },
          banned: { background: '#fce8e8', foreground: '#b42318' },
        };
      const palette = colors[cell.data.trim().toLowerCase()];
      if (!palette) {
        drawContent();
        return;
      }

      ctx.save();
      ctx.font = `500 12px ${theme.fontFamily}`;
      const width = Math.min(
        ctx.measureText(cell.displayData).width + 30,
        rect.width - 24
      );
      const left = rect.x + theme.cellHorizontalPadding;
      const top = rect.y + (rect.height - 24) / 2;
      ctx.fillStyle = palette.background;
      ctx.beginPath();
      ctx.roundRect(left, top, width, 24, 5);
      ctx.fill();
      ctx.fillStyle = palette.foreground;
      ctx.beginPath();
      ctx.arc(left + 10, top + 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        cell.displayData,
        left + 19,
        top + 12,
        Math.max(1, width - 24)
      );
      ctx.restore();
    },
    [columns]
  );

  // Handle cell clicks (double-click to navigate)
  const handleCellClick = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      const column = columns[col];

      if (column?.id === 'customerName' && row < filteredCustomers.length) {
        const now = Date.now();
        const lastClick = lastClickRef.current;

        if (
          lastClick &&
          lastClick.cell[0] === col &&
          lastClick.cell[1] === row &&
          now - lastClick.time < 500
        ) {
          const customer = filteredCustomers[row];
          if (customer?.id) {
            const target = buildWorkspacePath(
              selectedBusiness,
              'operations',
              `/customers/${customer.id}`
            );
            router.push(target);
          }
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { cell, time: now };
        }
      }
    },
    [columns, filteredCustomers, router, selectedBusiness]
  );

  return {
    columns,
    getData,
    getRowCount,
    drawCell,
    handleCellClick,
  };
}
