import {
  generalMerchandiseExpenseService,
  GeneralMerchandiseExpenseQuerySchema,
  GeneralMerchandiseExpenseBatchCreateSchema,
  GeneralMerchandiseExpenseStatusSchema,
  GeneralMerchandiseExpenseCategorySchema,
} from '@/modules/general-merchandise/ledger/api';
import {
  createExpenseRoutes,
  sanitizeCaseInsensitiveSchemaOption,
  sanitizeUppercaseQueryParam,
} from '@/modules/shared/ledger/expenses/api/routeFactory';

const { GET, POST, PUT, PATCH, DELETE } = createExpenseRoutes({
  service: generalMerchandiseExpenseService,
  schemas: {
    query: GeneralMerchandiseExpenseQuerySchema,
    batchCreate: GeneralMerchandiseExpenseBatchCreateSchema,
  },
  sanitizeStatus: (value) =>
    sanitizeCaseInsensitiveSchemaOption(
      value,
      GeneralMerchandiseExpenseStatusSchema
    ),
  sanitizeCategory: (value) =>
    sanitizeCaseInsensitiveSchemaOption(
      value,
      GeneralMerchandiseExpenseCategorySchema
    ),
  buildAdditionalQuery: (searchParams) => ({
    sourceType: sanitizeUppercaseQueryParam(searchParams.get('sourceType')),
  }),
  logMessages: {
    fetched: 'GM expenses fetched',
    fetchFailed: 'Failed to fetch GM expenses',
    created: 'GM expenses created',
    createFailed: 'Failed to import GM expenses',
    bulkUpdateFailed: 'Failed to bulk update GM expenses',
    singleUpdateFailed: 'Failed to update GM expense',
    massDeleteExecuted: 'GM mass deletion executed',
    deleteFailed: 'Failed to delete GM expenses',
  },
});

export { GET, POST, PUT, PATCH, DELETE };
