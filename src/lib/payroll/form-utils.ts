export type PayrollFormLike = {
  basicSalary: string;
  allowance: string;
  overtime: string;
  bonuses: string;
  thirteenthMonth: string;
  sss: string;
  philHealth: string;
  pagIbig: string;
  tax: string;
  loans: string;
  cashAdvance: string;
  lwop: string;
  absentsLates: string;
};

export const parsePayrollPeriodLabel = (label: string) => {
  if (!label) {
    return null;
  }

  const separator = label.includes(' to ')
    ? ' to '
    : label.includes(' - ')
      ? ' - '
      : null;

  if (!separator) {
    return null;
  }

  const [startRaw, endRaw] = label.split(separator);
  const start = startRaw?.trim();
  const end = endRaw?.trim();

  if (!start || !end) {
    return null;
  }

  return { start, end };
};

export const calculatePayrollTotals = (formData: PayrollFormLike) => {
  const basicSalary = parseFloat(formData.basicSalary) || 0;
  const allowance = parseFloat(formData.allowance) || 0;
  const overtime = parseFloat(formData.overtime) || 0;
  const bonuses = parseFloat(formData.bonuses) || 0;
  const thirteenthMonth = parseFloat(formData.thirteenthMonth) || 0;
  const sss = parseFloat(formData.sss) || 0;
  const philHealth = parseFloat(formData.philHealth) || 0;
  const pagIbig = parseFloat(formData.pagIbig) || 0;
  const tax = parseFloat(formData.tax) || 0;
  const loans = parseFloat(formData.loans) || 0;
  const cashAdvance = parseFloat(formData.cashAdvance) || 0;
  const lwop = parseFloat(formData.lwop) || 0;
  const absentsLates = parseFloat(formData.absentsLates) || 0;

  const grossPay =
    basicSalary + allowance + overtime + bonuses + thirteenthMonth;
  const totalDeductions =
    sss +
    philHealth +
    pagIbig +
    tax +
    loans +
    cashAdvance +
    lwop +
    absentsLates;
  const netPay = grossPay - totalDeductions;

  return {
    grossPay,
    totalDeductions,
    netPay: Math.max(0, netPay),
  };
};
