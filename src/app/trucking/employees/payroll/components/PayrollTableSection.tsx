import { memo, useMemo, useState, type ReactNode } from 'react';
import { Box, Text } from '@mantine/core';
import {
  DataTable,
  type TableAction,
  type TableColumn,
} from '@/components/shared/PageTemplates/DataTable';
import type { Payroll, PayrollColumnTotals } from '../types';

interface PayrollTableSectionProps {
  data: Payroll[];
  columns: TableColumn<Payroll>[];
  actions: TableAction<Payroll>[];
  columnTotals: PayrollColumnTotals;
  totalPayrolls: number;
  formatCurrency: (value: number) => string;
}

export const PayrollTableSection = memo(function PayrollTableSection({
  data,
  columns,
  actions,
  columnTotals,
  totalPayrolls,
  formatCurrency,
}: PayrollTableSectionProps) {
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  const summaryGridTemplate = useMemo(() => {
    if (columnWidths.length === 0) {
      const columnCount = columns.length + (actions.length > 0 ? 1 : 0);
      return `repeat(${columnCount}, minmax(0, 1fr))`;
    }

    return columnWidths.map((width) => `${width}px`).join(' ');
  }, [actions.length, columnWidths, columns.length]);

  const summaryCells = useMemo(() => {
    return columns.map((column) => {
      const alignment = column.align || 'center';
      let content: ReactNode = null;

      switch (column.key) {
        case 'employee':
          content = (
            <div>
              <Text fw={600}>Totals</Text>
              <Text size="xs" c="dimmed">
                Showing {data.length} of {totalPayrolls} records
              </Text>
            </div>
          );
          break;
        case 'basicSalary':
          content = formatCurrency(columnTotals.basicSalary);
          break;
        case 'allowance':
          content = formatCurrency(columnTotals.allowance);
          break;
        case 'overtime':
          content = formatCurrency(columnTotals.overtime);
          break;
        case 'bonuses':
          content = formatCurrency(columnTotals.bonuses);
          break;
        case 'thirteenthMonth':
          content = formatCurrency(columnTotals.thirteenthMonth);
          break;
        case 'grossPay':
          content = (
            <Text fw={700} c="green">
              {formatCurrency(columnTotals.grossPay)}
            </Text>
          );
          break;
        case 'sss':
          content = formatCurrency(columnTotals.sss);
          break;
        case 'philHealth':
          content = formatCurrency(columnTotals.philHealth);
          break;
        case 'pagIbig':
          content = formatCurrency(columnTotals.pagIbig);
          break;
        case 'tax':
          content = formatCurrency(columnTotals.tax);
          break;
        case 'loans':
          content = formatCurrency(columnTotals.loans);
          break;
        case 'cashAdvance':
          content = formatCurrency(columnTotals.cashAdvance);
          break;
        case 'lwop':
          content = formatCurrency(columnTotals.lwop);
          break;
        case 'absentsLates':
          content = formatCurrency(columnTotals.absentsLates);
          break;
        case 'totalDeductions':
          content = (
            <Text fw={700} c="red">
              {formatCurrency(columnTotals.totalDeductions)}
            </Text>
          );
          break;
        case 'netPay':
          content = (
            <Text fw={800} c="blue">
              {formatCurrency(columnTotals.netPay)}
            </Text>
          );
          break;
        default:
          content = null;
          break;
      }

      return (
        <Box
          key={`summary-${column.key}`}
          style={{
            padding: '8px 12px',
            textAlign: alignment,
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              alignment === 'left'
                ? 'flex-start'
                : alignment === 'right'
                  ? 'flex-end'
                  : 'center',
          }}
        >
          {typeof content === 'string' ? <Text>{content}</Text> : content}
        </Box>
      );
    });
  }, [columns, data.length, totalPayrolls, columnTotals, formatCurrency]);

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      emptyMessage="No payroll records found"
      showSummary
      summaryLeft={null}
      summaryRight={
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: summaryGridTemplate,
            width: '100%',
            borderTop: '1px solid var(--mantine-color-gray-3)',
          }}
        >
          {summaryCells}
          {actions.length > 0 && (
            <Box key="summary-actions" style={{ padding: '8px 12px' }}></Box>
          )}
        </Box>
      }
      onColumnWidthsChange={setColumnWidths}
    />
  );
});
