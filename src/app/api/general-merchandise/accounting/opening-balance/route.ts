import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';
import { createOpeningBalanceRouteHandlers } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';
import type { OpeningBalanceModel } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';

function getOpeningBalanceModel(
  client: object,
  modelName: string
): OpeningBalanceModel | undefined {
  const candidate = Reflect.get(client, modelName);
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  const findMany = Reflect.get(candidate, 'findMany');
  const create = Reflect.get(candidate, 'create');
  const update = Reflect.get(candidate, 'update');
  const deleteMethod = Reflect.get(candidate, 'delete');

  if (
    typeof findMany !== 'function' ||
    typeof create !== 'function' ||
    typeof update !== 'function' ||
    typeof deleteMethod !== 'function'
  ) {
    return undefined;
  }

  return candidate as OpeningBalanceModel;
}

const handlers = createOpeningBalanceRouteHandlers({
  cutover: () => getRuntimeAccountingCutoverDate('generalMerchandise'),
  getModel: () =>
    getOpeningBalanceModel(
      prisma,
      'generalMerchandiseAccountingOpeningBalance'
    ),
  runInTransaction: (work) =>
    prisma.$transaction(async (tx) => {
      const model = getOpeningBalanceModel(
        tx,
        'generalMerchandiseAccountingOpeningBalance'
      );
      if (!model) {
        throw new Error('Opening balance model is unavailable in transaction.');
      }
      return work(model);
    }),
  modelUnavailableMessage:
    'Opening balances are not enabled in this database yet',
  modelUnavailableDetail:
    'Missing table: general_merchandise.accounting_opening_balances. Create/apply the required schema to enable opening balances.',
  getReturnsEmptyWhenModelMissing: true,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
