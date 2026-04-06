import {
  expenseService,
  ExpenseQuerySchema,
  ExpenseBatchCreateSchema,
  ExpenseStatusSchema,
  ExpenseCategorySchema,
} from '@/modules/clothing/ledger/api';
import {
  createExpenseRoutes,
  sanitizeCaseInsensitiveSchemaOption,
  sanitizeUppercaseQueryParam,
} from '@/modules/shared/ledger/expenses/api/routeFactory';

const { GET, POST, PUT, PATCH, DELETE } = createExpenseRoutes({
  service: expenseService,
  schemas: {
    query: ExpenseQuerySchema,
    batchCreate: ExpenseBatchCreateSchema,
  },
  sanitizeStatus: (value) =>
    sanitizeCaseInsensitiveSchemaOption(value, ExpenseStatusSchema),
  sanitizeCategory: (value) =>
    sanitizeCaseInsensitiveSchemaOption(value, ExpenseCategorySchema),
  buildAdditionalQuery: (searchParams) => ({
    sourceType: sanitizeUppercaseQueryParam(searchParams.get('sourceType')),
  }),
  logMessages: {
    fetched: 'Expenses fetched',
    fetchFailed: 'Failed to fetch expenses',
    created: 'Expenses created',
    createFailed: 'Failed to import expenses',
    bulkUpdateFailed: 'Failed to bulk update expenses',
    singleUpdateFailed: 'Failed to update expense',
    massDeleteExecuted: 'Mass deletion executed',
    deleteFailed: 'Failed to delete expenses',
  },
});

export { GET, POST, PUT, PATCH, DELETE };
