import { memo, useMemo } from 'react';
import { Table } from '@mantine/core';
import { StandardDataTable } from '@/components/tables/StandardDataTable';
import type { DueDateItem, DueDateTransaction } from '../types/dueDate.types';
import { DueDateOrderRow } from './DueDateOrderRow';

interface DueDatesTableProps {
  headers: readonly string[];
  filteredItems: DueDateItem[];
  emptyState: string;
  getCustomerOrders: (customerName: string) => DueDateTransaction[];
  getFacebookLink: (customerName: string) => string;
}

export const DueDatesTable = memo(
  ({
    headers,
    filteredItems,
    emptyState,
    getCustomerOrders,
    getFacebookLink,
  }: DueDatesTableProps) => {
    const rows = useMemo(() => {
      const allRows: JSX.Element[] = [];

      filteredItems.forEach((item, customerIndex) => {
        const customerOrders = getCustomerOrders(item.customer);
        const facebookLink = getFacebookLink(item.customer);
        const isLastCustomerGroup = customerIndex === filteredItems.length - 1;

        customerOrders.forEach((order, orderIndex) => {
          const isFirstInGroup = orderIndex === 0;
          const isLastInGroup = orderIndex === customerOrders.length - 1;
          const uniqueKey = `${item.customer}-${order['Product Code']}-${order['Invoice Date']}-${order['Line Total']}-${order.Quantity}-${order['Order Date'] || 'no-date'}`;

          allRows.push(
            <DueDateOrderRow
              key={uniqueKey}
              order={order}
              isLastInGroup={isLastInGroup}
              isFirstInGroup={isFirstInGroup}
              customerName={item.customer}
              facebookLink={facebookLink}
              rowSpan={customerOrders.length}
            />
          );
        });

        if (!isLastCustomerGroup) {
          allRows.push(
            <Table.Tr
              key={`separator-${item.customer}`}
              style={{ height: '20px' }}
            >
              <Table.Td
                colSpan={10}
                style={{ border: 'none', backgroundColor: '#ffffffff' }}
              />
            </Table.Tr>
          );
        }
      });

      return allRows;
    }, [filteredItems, getCustomerOrders, getFacebookLink]);

    return (
      <StandardDataTable
        headers={headers}
        emptyState={emptyState}
        colSpan={headers.length}
        height="86vh"
        withoutRowBorders
        withTableBorder={false}
      >
        {rows}
      </StandardDataTable>
    );
  }
);

DueDatesTable.displayName = 'DueDatesTable';
