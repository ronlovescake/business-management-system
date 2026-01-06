const EXPENSE_CATEGORY_OPTIONS = [
  'Driver Pay',
  'Fuel',
  'Helper Pay',
  'Load/Unload Fees',
  'Maintenance & Repairs',
  'Misc',
  'Meal',
  'Parking Fees',
  'Toll Fees',
  'Transportation',
  'Truck Washing / Cleaning',
  'Permits & Registration',
  'Vehicle Purchase',
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
