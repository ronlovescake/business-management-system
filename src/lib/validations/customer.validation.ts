import { z } from 'zod';

/**
 * Customer Validation Schema
 *
 * Comprehensive validation for customer data with proper error messages
 */

/**
 * Phone number validation regex (supports various formats)
 * Examples: (123) 456-7890, 123-456-7890, 123.456.7890, +1234567890
 */
const phoneRegex =
  /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;

/**
 * Email validation (built-in Zod email validation)
 */
const emailSchema = z.string().email('Invalid email address format');

/**
 * URL validation for social media links
 */
const urlSchema = z.string().url('Invalid URL format').or(z.literal(''));

/**
 * Customer Name validation
 */
const customerNameSchema = z
  .string()
  .trim()
  .min(2, 'Customer name must be at least 2 characters')
  .max(100, 'Customer name must not exceed 100 characters')
  .refine((val) => val.length > 0, {
    message: 'Customer name is required',
  });

/**
 * Phone Number validation
 */
const phoneNumberSchema = z
  .string()
  .trim()
  .refine((val) => val === '' || phoneRegex.test(val), {
    message:
      'Invalid phone number format. Use formats like: (123) 456-7890, 123-456-7890, or +1234567890',
  });

/**
 * Address validation
 */
const addressSchema = z
  .string()
  .trim()
  .max(500, 'Address must not exceed 500 characters');

/**
 * Business Name validation
 */
const businessNameSchema = z
  .string()
  .trim()
  .max(200, 'Business name must not exceed 200 characters');

/**
 * Tax Number validation (optional, but must match format if provided)
 */
const taxNumberSchema = z
  .string()
  .trim()
  .refine((val) => val === '' || /^[A-Z0-9-]{5,20}$/.test(val), {
    message:
      'Invalid tax number format. Should be 5-20 alphanumeric characters and dashes',
  });

/**
 * Customer Status validation
 */
const customerStatusSchema = z.enum(
  ['Active', 'Inactive', 'Prospect', 'VIP', 'Banned'],
  {
    errorMap: () => ({
      message:
        'Customer status must be one of: Active, Inactive, Prospect, VIP, or Banned',
    }),
  }
);

/**
 * Customer Form Data Schema
 * Used for validating data from Add/Edit Customer forms
 */
export const customerFormSchema = z.object({
  customerName: customerNameSchema,
  phoneNumber: phoneNumberSchema,
  address: addressSchema,
  facebook: urlSchema,
  emailAddress: emailSchema.or(z.literal('')),
  businessName: businessNameSchema,
  taxNumber: taxNumberSchema,
  businessAddress: addressSchema,
  businessContactNumber: phoneNumberSchema,
  customerStatus: customerStatusSchema,
});

/**
 * Customer Data Schema
 * Used for validating full customer data (with API field names)
 */
export const customerDataSchema = z.object({
  id: z.number().int().positive().optional(),
  Date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .or(z.literal('')),
  'Customer Name': customerNameSchema,
  'Phone Number': phoneNumberSchema,
  Address: addressSchema,
  Facebook: urlSchema,
  'Email Address': emailSchema.or(z.literal('')),
  'Business Name': businessNameSchema,
  'Tax Number': taxNumberSchema,
  'Business Address': addressSchema,
  'Business Contact Number': phoneNumberSchema,
  'Customer Status': customerStatusSchema.or(z.literal('')),
});

/**
 * Partial Customer Data Schema (for updates)
 */
export const partialCustomerDataSchema = customerDataSchema.partial();

/**
 * Bulk Customer Import Schema
 * Validates array of customers for CSV import
 */
export const bulkCustomerSchema = z.array(customerDataSchema).min(1, {
  message: 'At least one customer is required for bulk import',
});

/**
 * Customer Query Parameters Schema
 * For validating URL query parameters
 */
export const customerQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().max(200).optional(),
  status: customerStatusSchema.optional(),
  sortBy: z
    .enum(['Date', 'Customer Name', 'Business Name', 'Customer Status'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Type inference from schemas
 */
export type CustomerFormInput = z.infer<typeof customerFormSchema>;
export type CustomerDataInput = z.infer<typeof customerDataSchema>;
export type PartialCustomerDataInput = z.infer<
  typeof partialCustomerDataSchema
>;
export type BulkCustomerInput = z.infer<typeof bulkCustomerSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;

/**
 * Validation helper functions
 */

/**
 * Validate customer form data
 */
export function validateCustomerForm(data: unknown) {
  return customerFormSchema.safeParse(data);
}

/**
 * Validate full customer data
 */
export function validateCustomerData(data: unknown) {
  return customerDataSchema.safeParse(data);
}

/**
 * Validate partial customer data (for updates)
 */
export function validatePartialCustomerData(data: unknown) {
  return partialCustomerDataSchema.safeParse(data);
}

/**
 * Validate bulk customer import
 */
export function validateBulkCustomers(data: unknown) {
  return bulkCustomerSchema.safeParse(data);
}

/**
 * Validate customer query parameters
 */
export function validateCustomerQuery(data: unknown) {
  return customerQuerySchema.safeParse(data);
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
 * Check if email is disposable (optional extra validation)
 */
const disposableEmailDomains = [
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'guerrillamail.com',
];

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableEmailDomains.includes(domain);
}

/**
 * Advanced customer validation with business rules
 */
export function validateCustomerWithBusinessRules(data: unknown) {
  const result = customerFormSchema.safeParse(data);

  if (!result.success) {
    return result;
  }

  // Additional business rule validations
  const customErrors: z.ZodIssue[] = [];

  // Check for disposable email
  if (result.data.emailAddress && isDisposableEmail(result.data.emailAddress)) {
    customErrors.push({
      code: 'custom',
      path: ['emailAddress'],
      message: 'Disposable email addresses are not allowed',
    });
  }

  // Check if at least one contact method is provided
  const hasContact =
    result.data.phoneNumber ||
    result.data.emailAddress ||
    result.data.facebook ||
    result.data.businessContactNumber;

  if (!hasContact) {
    customErrors.push({
      code: 'custom',
      path: ['phoneNumber'],
      message:
        'At least one contact method (phone, email, or social media) is required',
    });
  }

  if (customErrors.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError(customErrors),
    };
  }

  return result;
}
