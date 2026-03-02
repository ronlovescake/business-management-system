import type { NextRequest } from 'next/server';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';
import { createOpeningBalanceRouteHandlers } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';
import type { OpeningBalanceModel } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';

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

function createHandlers(cutover: Date) {
  return createOpeningBalanceRouteHandlers({
    cutover,
    getModel: () => getOpeningBalanceModel('clothingAccountingOpeningBalance'),
    modelUnavailableMessage:
      'Opening balances are not enabled in this database yet',
    modelUnavailableDetail:
      'Missing table: clothing_accounting_opening_balances. Create/apply the required schema to enable opening balances.',
    getReturnsEmptyWhenModelMissing: false,
  });
}

export async function GET(request: NextRequest) {
  const handlers = createHandlers(await getRuntimeAccountingCutoverDate());
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const handlers = createHandlers(await getRuntimeAccountingCutoverDate());
  return handlers.POST(request);
}

export async function PUT(request: NextRequest) {
  const handlers = createHandlers(await getRuntimeAccountingCutoverDate());
  return handlers.PUT(request);
}

export async function DELETE(request: NextRequest) {
  const handlers = createHandlers(await getRuntimeAccountingCutoverDate());
  return handlers.DELETE(request);
}
