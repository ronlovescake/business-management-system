export function resolveThirteenthMonthRecordId(payrollRecord: {
  employeeId?: string | null;
  payPeriod: string;
}) {
  let year = new Date().getFullYear();
  if (payrollRecord.payPeriod) {
    const endDateStr =
      payrollRecord.payPeriod.split(' to ')[1] ||
      payrollRecord.payPeriod.split(' - ')[1] ||
      payrollRecord.payPeriod;
    const parsedDate = new Date(endDateStr);
    if (!Number.isNaN(parsedDate.getTime())) {
      year = parsedDate.getFullYear();
    }
  }

  return `${(payrollRecord.employeeId || '').toLowerCase()}-${year}`;
}
