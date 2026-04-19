import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';
import { createManualJournalRouteHandlers } from '@/modules/shared/ledger/manual-journal/api/routeAdapter';

const handlers = createManualJournalRouteHandlers(prisma, {
  cutover: () => getRuntimeAccountingCutoverDate('generalMerchandise'),
  missingTableResponseDetail:
    'Missing table: general_merchandise.accounting_journal_lines. Create/apply the required schema to enable manual entries.',
  getModel: (client) => {
    return (
      client as {
        generalMerchandiseAccountingJournalLine?: {
          create?: (args: unknown) => Promise<unknown>;
          findMany?: (
            args: unknown
          ) => Promise<Array<{ sourceLineKey: string }>>;
          updateMany?: (args: unknown) => Promise<{ count: number }>;
          deleteMany?: (args: unknown) => Promise<{ count: number }>;
        };
      }
    ).generalMerchandiseAccountingJournalLine;
  },
  updateMode: 'replace',
  sourceIdRequiredForPutMessage: 'Source id is required.',
  sourceIdRequiredForDeleteMessage: 'Source id is required.',
  updateMissingEntryMessage: 'No manual journal entry found to update.',
  deleteMissingReturnsNotFound: false,
  deleteWhere: (sourceId) => ({ sourceId }),
  replacePutDeleteWhere: (sourceId) => ({ sourceId }),
  inplaceLookupWhere: (sourceId) => ({
    // Filter out soft-deleted journal lines (column added 2026-04-19).
    deletedAt: null,
    sourceType: 'MANUAL',
    sourceId,
    systemGenerated: false,
    sourceLineKey: { in: ['debit', 'credit'] },
  }),
  inplaceDebitWhere: (sourceId) => ({
    sourceType: 'MANUAL',
    sourceId,
    systemGenerated: false,
    sourceLineKey: 'debit',
  }),
  inplaceCreditWhere: (sourceId) => ({
    sourceType: 'MANUAL',
    sourceId,
    systemGenerated: false,
    sourceLineKey: 'credit',
  }),
});

export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
