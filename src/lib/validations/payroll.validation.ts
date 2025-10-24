import { z } from 'zod';

/**
 * Payroll Validation Schema
 */

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const payrollStatusSchema = z.enum(['pending', 'approved', 'paid'], {
  errorMap: () => ({
    message: 'Payroll status must be: pending, approved, or paid',
  }),
});

export const payrollSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(50),
  employeeName: z.string().trim().min(1, 'Employee name is required').max(255),

  // Pay Period
  payPeriod: z.string().trim().min(1, 'Pay period is required').max(50),
  periodStart: z
    .string()
    .regex(dateRegex, 'Period start must be in YYYY-MM-DD format'),
  periodEnd: z
    .string()
    .regex(dateRegex, 'Period end must be in YYYY-MM-DD format'),

  // Earnings
  basicSalary: z
    .number()
    .nonnegative('Basic salary cannot be negative')
    .default(0),
  allowance: z.number().nonnegative('Allowance cannot be negative').default(0),
  overtime: z.number().nonnegative('Overtime cannot be negative').default(0),
  bonuses: z.number().nonnegative('Bonuses cannot be negative').default(0),
  thirteenthMonth: z
    .number()
    .nonnegative('13th month pay cannot be negative')
    .default(0),
  grossPay: z.number().nonnegative('Gross pay cannot be negative').default(0),

  // Deductions
  sss: z.number().nonnegative('SSS deduction cannot be negative').default(0),
  philHealth: z
    .number()
    .nonnegative('PhilHealth deduction cannot be negative')
    .default(0),
  pagIbig: z
    .number()
    .nonnegative('Pag-IBIG deduction cannot be negative')
    .default(0),
  tax: z.number().nonnegative('Tax deduction cannot be negative').default(0),
  loans: z
    .number()
    .nonnegative('Loans deduction cannot be negative')
    .default(0),
  cashAdvance: z
    .number()
    .nonnegative('Cash advance deduction cannot be negative')
    .default(0),
  lwop: z.number().nonnegative('LWOP deduction cannot be negative').default(0),
  absentsLates: z
    .number()
    .nonnegative('Absents/Lates deduction cannot be negative')
    .default(0),
  totalDeductions: z
    .number()
    .nonnegative('Total deductions cannot be negative')
    .default(0),

  // Net Pay
  netPay: z.number().default(0), // Can be negative if deductions exceed gross

  // Status & Approval
  status: payrollStatusSchema.default('pending'),
  bankGcash: z.string().trim().max(255).default(''),
  approvedBy: z.string().trim().max(255).optional().nullable(),
  approvedDate: z
    .string()
    .regex(dateRegex, 'Approved date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  paidDate: z
    .string()
    .regex(dateRegex, 'Paid date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),

  // Additional Information
  unpaidDays: z
    .number()
    .int()
    .nonnegative('Unpaid days cannot be negative')
    .default(0),
  dailyRate: z.number().nonnegative('Daily rate cannot be negative').default(0),
  deduction: z.number().nonnegative('Deduction cannot be negative').default(0),
  notes: z.string().trim().optional().nullable(),
});

export const payrollUpdateSchema = payrollSchema.partial();

export const bulkPayrollSchema = z.array(payrollSchema).min(1);

export type PayrollInput = z.infer<typeof payrollSchema>;
export type PayrollUpdateInput = z.infer<typeof payrollUpdateSchema>;

export function validatePayroll(data: unknown) {
  return payrollSchema.safeParse(data);
}

export function formatValidationErrors(
  errors: z.ZodError
): Record<string, string> {
  const formattedErrors: Record<string, string> = {};
  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  });
  return formattedErrors;
}
