const EXPENSE_CATEGORY_OPTIONS = [
  'Food',
  'Load/Unload Fees',
  'Maintenance & Repairs',
  'Packaging',
  'Parking Fees',
  'Payroll',
  'Permits & Registration',
  'Products',
  'Shipping / Delivery Fee',
  'Toll Fees',
  'Transportation',
  'Truck Washing / Cleaning',
  'Utilities - Electricity',
  'Utilities - Internet',
  'Utilities - Water',
  'Vehicle Purchase',
  'Warehouse Rental',
] as const;

export const expenseCategoryOptions = EXPENSE_CATEGORY_OPTIONS;
export const validExpenseCategories = [...EXPENSE_CATEGORY_OPTIONS];

/**
 * Validate whether the provided category is part of the supported expense categories.
 */
export function isValidCategory(category: string): boolean {
  if (!category) {
    return false;
  }

  const normalized = category.trim().toLowerCase();
  return EXPENSE_CATEGORY_OPTIONS.some(
    (validCategory) => validCategory.toLowerCase() === normalized
  );
}
