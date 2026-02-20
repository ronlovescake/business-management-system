import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';
import { createOpeningBalanceRouteHandlers } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';
import type { OpeningBalanceModel } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';

const CUTOVER = getAccountingCutoverDate();

function getOpeningBalanceModel(
  modelName: string
): OpeningBalanceModel | undefined {
  const candidate = Reflect.get(prisma, modelName);
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
  cutover: CUTOVER,
  getModel: () => getOpeningBalanceModel('clothingAccountingOpeningBalance'),
  modelUnavailableMessage:
    'Opening balances are not enabled in this database yet',
  modelUnavailableDetail:
    'Missing table: clothing_accounting_opening_balances. Create/apply the required schema to enable opening balances.',
  getReturnsEmptyWhenModelMissing: false,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
