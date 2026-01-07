import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { normalizePaymentCardPayload } from '@/modules/settings/global/utils/paymentCardValidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async () => {
  const cards = await prisma.paymentCard.findMany({
    orderBy: [{ bank: 'asc' }, { label: 'asc' }],
  });
  return ApiResponse.success(cards, 'Payment cards fetched');
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const payload = await request.json();
  const { data, errors } = normalizePaymentCardPayload(payload);

  if (!data) {
    return ApiResponse.badRequest('Validation failed', errors);
  }

  const card = await prisma.paymentCard.create({ data });
  logger.info('Payment card saved', {
    id: card.id,
    bank: card.bank,
    label: card.label,
  });

  return ApiResponse.success(card, 'Payment card saved', HTTP_STATUS.CREATED);
});
