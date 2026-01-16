export type ExpenseFilterOptions<T> = {
  searchQuery: string;
  filterCategory: string | null;
  filterStatus: string | null;
  filterSource?: string | null;
  getSearchTokens: (expense: T) => Array<string | undefined | null>;
  getCategory: (expense: T) => string;
  getStatus: (expense: T) => string;
  getSourceLabel?: (expense: T) => string;
  getDate: (expense: T) => string;
};

export function filterAndSortExpenses<T>(
  expenses: T[],
  options: ExpenseFilterOptions<T>
): T[] {
  const search = options.searchQuery.trim().toLowerCase();

  const filtered = expenses.filter((expense) => {
    const matchesSearch =
      search === '' ||
      options
        .getSearchTokens(expense)
        .filter(Boolean)
        .some((token) => String(token).toLowerCase().includes(search));

    const matchesCategory =
      !options.filterCategory ||
      options.getCategory(expense) === options.filterCategory;

    const matchesStatus =
      !options.filterStatus ||
      options.getStatus(expense) === options.filterStatus;

    const sourceLabel = options.getSourceLabel?.(expense);
    const matchesSource =
      !options.filterSource || sourceLabel === options.filterSource;

    return matchesSearch && matchesCategory && matchesStatus && matchesSource;
  });

  return filtered.sort((a, b) => {
    const dateA = new Date(options.getDate(a)).getTime();
    const dateB = new Date(options.getDate(b)).getTime();
    return dateB - dateA;
  });
}
