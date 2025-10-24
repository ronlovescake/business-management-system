import { z } from 'zod';

/**
 * Employee Validation Schema
 * Comprehensive validation for employee data with proper error messages
 */

/**
 * Phone number validation regex
 */
const phoneRegex =
  /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;

/**
 * Employee ID validation (alphanumeric with hyphens)
 */
const employeeIdRegex = /^[A-Z0-9-]{3,50}$/i;

/**
 * Date validation (YYYY-MM-DD format)
 */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Employee Status enum
 */
const employeeStatusSchema = z.enum(['active', 'inactive', 'on-leave'], {
  errorMap: () => ({
    message: 'Employee status must be: active, inactive, or on-leave',
  }),
});

/**
 * Employment Status enum
 */
const employmentStatusSchema = z.enum(
  ['probationary', 'regular', 'contractual', 'project-based'],
  {
    errorMap: () => ({
      message:
        'Employment status must be: probationary, regular, contractual, or project-based',
    }),
  }
);

/**
 * Employee Type enum
 */
const employeeTypeSchema = z.enum(
  ['full-time', 'part-time', 'contractor', 'intern'],
  {
    errorMap: () => ({
      message:
        'Employee type must be: full-time, part-time, contractor, or intern',
    }),
  }
);

/**
 * Gender enum
 */
const genderSchema = z.enum(['male', 'female', 'other', 'prefer-not-to-say'], {
  errorMap: () => ({
    message: 'Gender must be: male, female, other, or prefer-not-to-say',
  }),
});

/**
 * Marital Status enum
 */
const maritalStatusSchema = z.enum(
  ['single', 'married', 'divorced', 'widowed'],
  {
    errorMap: () => ({
      message: 'Marital status must be: single, married, divorced, or widowed',
    }),
  }
);

/**
 * Payment Schedule enum
 */
const paymentScheduleSchema = z.enum(
  ['weekly', 'bi-weekly', 'semi-monthly', 'monthly'],
  {
    errorMap: () => ({
      message:
        'Payment schedule must be: weekly, bi-weekly, semi-monthly, or monthly',
    }),
  }
);

/**
 * Employee Create/Update Schema
 */
export const employeeSchema = z.object({
  // Required fields
  employeeId: z
    .string()
    .trim()
    .regex(
      employeeIdRegex,
      'Employee ID must be 3-50 alphanumeric characters or hyphens'
    ),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  middleName: z.string().trim().max(100).optional().nullable(),
  name: z.string().trim().min(1, 'Full name is required').max(255),
  contact: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid phone number format')
    .min(1, 'Primary contact is required'),
  department: z.string().trim().min(1, 'Department is required').max(100),
  position: z.string().trim().min(1, 'Position is required').max(100),
  jobTitle: z.string().trim().min(1, 'Job title is required').max(100),
  basicSalary: z.number().positive('Basic salary must be positive'),
  hireDate: z
    .string()
    .regex(dateRegex, 'Hire date must be in YYYY-MM-DD format'),
  status: employeeStatusSchema,

  // Optional fields with validation
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid phone number format')
    .optional()
    .nullable(),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  emergencyContactPerson: z.string().trim().max(255).optional().nullable(),
  emergencyContactNumber: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid emergency contact number')
    .optional()
    .nullable(),
  emergencyContact: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid emergency contact')
    .optional()
    .nullable(),

  // Employment details
  employmentStatus: employmentStatusSchema.optional().nullable(),
  employeeType: employeeTypeSchema.optional().nullable(),
  office: z.string().trim().max(255).optional().nullable(),
  hiringSource: z.string().trim().max(100).optional().nullable(),

  // Compensation
  currentSalary: z
    .number()
    .positive('Current salary must be positive')
    .optional()
    .nullable(),
  allowance: z
    .number()
    .nonnegative('Allowance cannot be negative')
    .optional()
    .nullable(),
  paymentSchedule: paymentScheduleSchema.optional().nullable(),

  // Statutory contributions
  sssMonthlyContribution: z
    .number()
    .nonnegative('SSS contribution cannot be negative')
    .optional()
    .nullable(),
  philHealthMonthlyContribution: z
    .number()
    .nonnegative('PhilHealth contribution cannot be negative')
    .optional()
    .nullable(),
  pagibigMonthlyContribution: z
    .number()
    .nonnegative('Pag-IBIG contribution cannot be negative')
    .optional()
    .nullable(),
  taxMonthlyContribution: z
    .number()
    .nonnegative('Tax contribution cannot be negative')
    .optional()
    .nullable(),

  // Financial accounts
  bankAccount: z.string().trim().max(255).optional().nullable(),
  gcashAccount: z.string().trim().max(50).optional().nullable(),

  // Government IDs
  sssNumber: z.string().trim().max(50).optional().nullable(),
  philHealthNumber: z.string().trim().max(50).optional().nullable(),
  hdmfNumber: z.string().trim().max(50).optional().nullable(),
  tinNumber: z.string().trim().max(50).optional().nullable(),

  // Personal information
  gender: genderSchema.optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(dateRegex, 'Date of birth must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  maritalStatus: maritalStatusSchema.optional().nullable(),
  numberOfKids: z
    .number()
    .int()
    .nonnegative('Number of kids cannot be negative')
    .optional()
    .nullable(),
  education: z.string().trim().max(255).optional().nullable(),
  drivingLicense: z.string().trim().max(100).optional().nullable(),
  profilePhoto: z
    .string()
    .trim()
    .url('Invalid profile photo URL')
    .optional()
    .nullable(),
});

/**
 * Partial schema for updates
 */
export const employeeUpdateSchema = employeeSchema.partial();

/**
 * Bulk employee import schema
 */
export const bulkEmployeeSchema = z.array(employeeSchema).min(1, {
  message: 'At least one employee is required for bulk import',
});

/**
 * Employee query parameters schema
 */
export const employeeQuerySchema = z.object({
  department: z.string().optional(),
  status: z.string().optional(),
  search: z.string().max(200).optional(),
});

/**
 * Type inference from schemas
 */
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type BulkEmployeeInput = z.infer<typeof bulkEmployeeSchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;

/**
 * Validation helper functions
 */
export function validateEmployee(data: unknown) {
  return employeeSchema.safeParse(data);
}

export function validateEmployeeUpdate(data: unknown) {
  return employeeUpdateSchema.safeParse(data);
}

export function validateBulkEmployees(data: unknown) {
  return bulkEmployeeSchema.safeParse(data);
}

export function validateEmployeeQuery(data: unknown) {
  return employeeQuerySchema.safeParse(data);
}

/**
 * Format Zod validation errors for user-friendly display
 */
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

/**
 * Business rule validation: At least one contact method required
 */
export function validateContactMethods(data: {
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
}): boolean {
  return !!(data.contact || data.phone || data.email);
}
