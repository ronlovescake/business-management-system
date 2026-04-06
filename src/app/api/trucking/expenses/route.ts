import {
  expenseService,
  ExpenseQuerySchema,
  ExpenseBatchCreateSchema,
  ExpenseStatusSchema,
  ExpenseCategorySchema,
} from '@/modules/trucking/employees/expenses/api';
import {
  createExpenseRoutes,
  sanitizeCaseInsensitiveSchemaOption,
  sanitizeStringQueryParam,
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
    vehicleId: sanitizeStringQueryParam(searchParams.get('vehicleId')),
  }),
  logMessages: {
    fetched: 'Trucking expenses fetched',
    fetchFailed: 'Failed to fetch trucking expenses',
    created: 'Trucking expenses created',
    createFailed: 'Failed to import trucking expenses',
    bulkUpdateFailed: 'Failed to bulk update trucking expenses',
    singleUpdateFailed: 'Failed to update trucking expense',
    massDeleteExecuted: 'Trucking mass deletion executed',
    deleteFailed: 'Failed to delete trucking expenses',
  },
  useServiceUpdateManyForBulkUpdate: true,
});

export { GET, POST, PUT, PATCH, DELETE };
