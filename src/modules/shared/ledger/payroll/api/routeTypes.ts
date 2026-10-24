import type { PayrollInput } from '@/lib/validations/payroll.validation';

export type PayrollRouteRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  payPeriod: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  bonuses: number;
  thirteenthMonth: number;
  grossPay: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  tax: number;
  loans: number;
  cashAdvance: number;
  lwop: number;
  absentsLates: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  bankGcash: string;
  approvedBy: string | null;
  approvedDate: string | null;
  paidDate: string | null;
  unpaidDays: number;
  dailyRate: number;
  deduction: number;
  notes: string | null;
  deletedAt: Date | null;
};

type PayrollModel<TRecord extends PayrollRouteRecord> = {
  findMany: (args: {
    where: Record<string, unknown>;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }) => Promise<TRecord[]>;
  findUnique: (args: { where: { id: string } }) => Promise<TRecord | null>;
  create: (args: { data: PayrollInput }) => Promise<TRecord>;
  update: (args: {
    where: { id: string };
    data: Partial<PayrollInput> | { deletedAt: Date };
  }) => Promise<TRecord>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

type EmployeeModel = {
  findMany: (args: {
    where: {
      employeeId: { in: string[] };
      deletedAt: null;
    };
    select: { employeeId: true };
  }) => Promise<Array<{ employeeId: string }>>;
};

export type PayrollRouteStore<TRecord extends PayrollRouteRecord> = {
  payrollModel: PayrollModel<TRecord>;
  employeeModel: EmployeeModel;
  createRecords: (records: PayrollInput[]) => Promise<TRecord[]>;
  syncPayrollDeductions: (payrolls: TRecord[]) => Promise<TRecord[]>;
  syncExpenseFromPayroll: (
    payroll: TRecord,
    processedBy?: string | null
  ) => Promise<void>;
};

export type PayrollRouteConfig<TRecord extends PayrollRouteRecord> =
  PayrollRouteStore<TRecord> & {
    withTransaction?: <T>(
      operation: (store: PayrollRouteStore<TRecord>) => Promise<T>
    ) => Promise<T>;
    shouldSync: (status: string) => boolean;
    lockPaidRecords?: boolean;
    logPrefix?: string;
  };
