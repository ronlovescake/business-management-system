import type { QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { getSwal } from '@/lib/alerts';

interface EmployeeDirectoryRecord {
  employeeId?: string;
  name?: string;
}

interface ImportPayrollCsvParams {
  file: File;
  resolveApiPath: (path: string) => string;
  resolveEmployeeRecord: (
    identifier: string | undefined | null
  ) => EmployeeDirectoryRecord | undefined;
  queryClient: QueryClient;
  payrollQueryKey: readonly unknown[];
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve((event.target?.result as string) ?? '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read CSV file'));
    };
    reader.readAsText(file);
  });
}

export async function importPayrollCsv({
  file,
  resolveApiPath,
  resolveEmployeeRecord,
  queryClient,
  payrollQueryKey,
}: ImportPayrollCsvParams): Promise<void> {
  const Swal = await getSwal();

  try {
    const text = await readFileAsText(file);
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return;
    }

    const [, ...rows] = lines;
    const unmatchedEmployees = new Set<string>();

    const payload = rows.map((row) => {
      const columns = row.split(',');
      const employee = columns[0]?.trim() ?? '';
      const payPeriod = columns[1]?.trim() ?? '';
      const [periodStart = '', periodEnd = ''] = payPeriod
        .split(' to ')
        .map((value) => value.trim());

      const employeeRecord = resolveEmployeeRecord(employee);

      const parseNumber = (value: string | undefined) => {
        const parsed = parseFloat((value ?? '').trim() || '0');
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const status = columns[18]?.trim().toLowerCase() || 'pending';

      if (!employeeRecord) {
        unmatchedEmployees.add(employee);
      }

      return {
        employeeId: employeeRecord?.employeeId,
        employeeName: employeeRecord?.name ?? employee,
        payPeriod,
        periodStart,
        periodEnd,
        basicSalary: parseNumber(columns[2]),
        allowance: parseNumber(columns[3]),
        overtime: parseNumber(columns[4]),
        bonuses: parseNumber(columns[5]),
        thirteenthMonth: parseNumber(columns[6]),
        grossPay: parseNumber(columns[7]),
        sss: parseNumber(columns[8]),
        philHealth: parseNumber(columns[9]),
        pagIbig: parseNumber(columns[10]),
        tax: parseNumber(columns[11]),
        loans: parseNumber(columns[12]),
        cashAdvance: parseNumber(columns[13]),
        lwop: parseNumber(columns[14]),
        absentsLates: parseNumber(columns[15]),
        totalDeductions: parseNumber(columns[16]),
        netPay: parseNumber(columns[17]),
        status,
        bankGcash: columns[19]?.trim() ?? '',
      };
    });

    if (payload.length === 0) {
      return;
    }

    await api.post(resolveApiPath('/payroll'), payload);
    queryClient.invalidateQueries({ queryKey: payrollQueryKey });

    if (unmatchedEmployees.size > 0) {
      await Swal.fire({
        title: 'Imported with Warnings',
        text: `Some employees could not be matched: ${Array.from(
          unmatchedEmployees
        ).join(
          ', '
        )}. Cash advance deductions applied only to matched employees.`,
        icon: 'warning',
        confirmButtonColor: '#f59e0b',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    }
  } catch (error) {
    logger.error('Error importing payroll CSV:', error);
    await Swal.fire({
      title: 'Import Failed',
      text: 'Failed to import payroll data. Please try again.',
      icon: 'error',
      confirmButtonColor: '#d33',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    });
  }
}
