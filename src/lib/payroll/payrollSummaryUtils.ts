type PayrollSummarySource = {
  payPeriod: string;
  status: string;
  netPay: number;
};

export const derivePayrollSummary = (payrolls: PayrollSummarySource[]) => {
  const totalPayrolls = payrolls.length;
  const pendingPayrolls = payrolls.filter(
    (payroll) => payroll.status === 'pending'
  ).length;
  const approvedPayrolls = payrolls.filter(
    (payroll) => payroll.status === 'approved'
  ).length;
  const totalNetPay = payrolls
    .filter((payroll) => payroll.status === 'paid')
    .reduce((sum, payroll) => sum + payroll.netPay, 0);

  return {
    totalPayrolls,
    pendingPayrolls,
    approvedPayrolls,
    totalNetPay,
  };
};

export const derivePayrollFilterPeriods = (
  payrolls: PayrollSummarySource[]
) => {
  const periods = Array.from(
    new Set(payrolls.map((payroll) => payroll.payPeriod))
  );
  return ['all', ...periods];
};
