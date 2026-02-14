import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';
import { createOpeningBalanceRouteHandlers } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';
import type { OpeningBalanceModel } from '@/modules/shared/ledger/opening-balance/api/routeAdapter';

const CUTOVER = getAccountingCutoverDate();

const handlers = createOpeningBalanceRouteHandlers({
  cutover: CUTOVER,
  getModel: () => {
    return (
      prisma as unknown as {
        generalMerchandiseAccountingOpeningBalance?: OpeningBalanceModel;
      }
    ).generalMerchandiseAccountingOpeningBalance;
  },
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
