const EXPENSE_CATEGORY_OPTIONS = [
  'Driver Pay',
  'Fuel',
  'Helper Pay',
  'Load/Unload Fees',
  'Maintenance & Repairs',
  'Meal',
  'Parking Fees',
  'Toll Fees',
  'Transportation',
  'Truck Washing / Cleaning',
  'Permits & Registration',
  'Vehicle Purchase',
  // Clothing business additions
  'Products',
  'Shipping / Delivery Fee',
  'Payroll',
  'Packaging',
  'Warehouse Rental',
  'Electricity Bill [Warehouse]',
  'Water Bill [Warehouse]',
  'Business Expense - Others',
  'Business Expense - Food',
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
