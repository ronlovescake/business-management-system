/**
 * React Query Keys
 * 
 * Centralized query key management for React Query.
 * This ensures consistent cache keys across the application and makes
 * cache invalidation easier.
 * 
 * Usage:
 * const { data } = useQuery({
 *   queryKey: queryKeys.transactions.all,
 *   queryFn: fetchTransactions,
 * });
 */

export const queryKeys = {
  // Transactions
  transactions: {
    all: ['transactions'] as const,
    lists: () => [...queryKeys.transactions.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.transactions.lists(), { filters }] as const,
    details: () => [...queryKeys.transactions.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.transactions.details(), id] as const,
  },

  // Products
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.products.lists(), { filters }] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.products.details(), id] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.customers.lists(), { filters }] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.customers.details(), id] as const,
  },

  // Prices
  prices: {
    all: ['prices'] as const,
    lists: () => [...queryKeys.prices.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.prices.lists(), { filters }] as const,
    details: () => [...queryKeys.prices.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.prices.details(), id] as const,
    byProduct: (productCode: string) =>
      [...queryKeys.prices.all, 'product', productCode] as const,
  },

  // Shipments
  shipments: {
    all: ['shipments'] as const,
    lists: () => [...queryKeys.shipments.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.shipments.lists(), { filters }] as const,
    details: () => [...queryKeys.shipments.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.shipments.details(), id] as const,
  },

  // Expenses
  expenses: {
    all: ['expenses'] as const,
    lists: () => [...queryKeys.expenses.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.expenses.lists(), { filters }] as const,
    details: () => [...queryKeys.expenses.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.expenses.details(), id] as const,
  },

  // Business Intelligence / Analytics
  analytics: {
    all: ['analytics'] as const,
    businessIntelligence: () =>
      [...queryKeys.analytics.all, 'business-intelligence'] as const,
    customerStats: (customerId: string) =>
      [...queryKeys.analytics.all, 'customer-stats', customerId] as const,
  },

  // Modules
  modules: {
    all: ['modules'] as const,
    performance: () => [...queryKeys.modules.all, 'performance'] as const,
    marketplace: () => [...queryKeys.modules.all, 'marketplace'] as const,
    config: (moduleId: string) =>
      [...queryKeys.modules.all, 'config', moduleId] as const,
  },
} as const;

/**
 * Helper type to extract query key types
 */
export type QueryKey = typeof queryKeys;
