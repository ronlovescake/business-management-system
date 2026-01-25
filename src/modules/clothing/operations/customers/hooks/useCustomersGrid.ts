import { useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  GridCellKind,
  type GridCell,
  type GridColumn,
  type Item,
} from '@glideapps/glide-data-grid';
import type { CustomerData } from '../types/customer.types';
import { useBusinessStore } from '@/lib/store';
import { buildWorkspacePath } from '@/lib/routes';

interface UseCustomersGridProps {
  filteredCustomers: CustomerData[];
}

export function useCustomersGrid({ filteredCustomers }: UseCustomersGridProps) {
  const router = useRouter();
  const { selectedBusiness } = useBusinessStore();
  const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);

  // Customer columns
  const columns: GridColumn[] = useMemo(
    () => [
      { title: 'Date', width: 160, id: 'date' },
      { title: 'Customer Name', width: 500, id: 'customerName' },
      { title: 'Phone Number', width: 190, id: 'phoneNumber' },
      { title: 'Address', width: 340, id: 'address' },
      { title: 'Facebook', width: 220, id: 'facebook' },
      { title: 'Email Address', width: 260, id: 'emailAddress' },
      { title: 'Business Name', width: 500, id: 'businessName' },
      { title: 'Tax Number', width: 170, id: 'taxNumber' },
      { title: 'Business Address', width: 340, id: 'businessAddress' },
      {
        title: 'Business Contact Number',
        width: 260,
        id: 'businessContactNumber',
      },
      { title: 'Customer Status', width: 120, id: 'customerStatus', grow: 1 },
    ],
    []
  );

  // Data rendering for grid
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      if (row >= filteredCustomers.length) {
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
        } as GridCell;
      }

      return {
        kind: GridCellKind.Text,
        data: cellData,
        displayData: cellData,
        allowOverlay: false,
        readonly: true,
      };
    },
    [filteredCustomers, columns]
  );

  const getRowCount = useCallback(
    () => filteredCustomers.length,
    [filteredCustomers]
  );

  interface DrawHeaderArgs {
    ctx: CanvasRenderingContext2D;
    column: GridColumn;
    rect: { x: number; y: number; width: number; height: number };
    theme: {
      bgHeader: string;
      textHeader: string;
      headerFontStyle: string;
    };
  }

  // Custom header renderer for center alignment
  const drawHeader = useCallback((args: DrawHeaderArgs) => {
    const { ctx, column, rect, theme } = args;

    ctx.fillStyle = theme.bgHeader;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    ctx.fillStyle = theme.textHeader;
    ctx.font = theme.headerFontStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(column.title, centerX, centerY);

    return true;
  }, []);

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
    drawHeader,
    handleCellClick,
  };
}
