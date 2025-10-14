const VALID_EXPENSE_CATEGORIES = [
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
] as const;

export const validExpenseCategories = [...VALID_EXPENSE_CATEGORIES];

/**
 * Validate whether the provided category is part of the supported expense categories.
 */
export function isValidCategory(category: string): boolean {
  if (!category) {
    return false;
  }

  const normalized = category.trim().toLowerCase();
  return VALID_EXPENSE_CATEGORIES.some(
    (validCategory) => validCategory.toLowerCase() === normalized
  );
}
