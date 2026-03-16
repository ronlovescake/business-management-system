import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';
import { createManualJournalRouteHandlers } from '@/modules/shared/ledger/manual-journal/api/routeAdapter';

const handlers = createManualJournalRouteHandlers(prisma, {
  cutover: () => getRuntimeAccountingCutoverDate(),
  missingTableResponseDetail:
    'Missing table: clothing_accounting_journal_lines. Create/apply the required schema to enable manual entries.',
  getModel: (client) => {
    return (
      client as {
        clothingAccountingJournalLine?: {
          create?: (args: unknown) => Promise<unknown>;
          findMany?: (
            args: unknown
          ) => Promise<Array<{ sourceLineKey: string }>>;
          updateMany?: (args: unknown) => Promise<unknown>;
          deleteMany?: (args: unknown) => Promise<{ count: number }>;
        };
      }
    ).clothingAccountingJournalLine;
  },
  updateMode: 'inplace',
  sourceIdRequiredForPutMessage: 'sourceId is required for editing an entry.',
  sourceIdRequiredForDeleteMessage: 'sourceId is required.',
  updateMissingEntryMessage: 'No manual journal entry found to update.',
  deleteMissingReturnsNotFound: true,
  deleteWhere: (sourceId) => ({
    sourceType: 'MANUAL',
    sourceId,
    systemGenerated: false,
  }),
  replacePutDeleteWhere: (sourceId) => ({
    sourceType: 'MANUAL',
    sourceId,
    systemGenerated: false,
  }),
  inplaceLookupWhere: (sourceId) => ({
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
