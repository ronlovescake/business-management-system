import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  applySupplierCredit,
  issueSupplierCredit,
  SupplierResolutionError,
  transferSupplierProduct,
} from '@/modules/products/api/supplier-resolution';

const base = { requestId: z.string().uuid() };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.discriminatedUnion('action', [
  z
    .object({
      ...base,
      action: z.literal('TRANSFER'),
      shipmentCode: z.string().trim().min(1).max(100),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal('ISSUE_CREDIT'),
      supplierReference: z.string().trim().min(1).max(200),
      reference: z.string().trim().min(1).max(150),
      postingDate: date,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal('APPLY_CREDIT'),
      supplierReference: z.string().trim().min(1).max(200),
      creditId: z.string().min(1).max(100),
      amount: z.number().finite().positive(),
      postingDate: date,
    })
    .strict(),
]);

export const POST = withErrorHandler<{ params: { id: string } }>(
  async (request: NextRequest, context) => {
    const id = z.coerce.number().int().positive().safeParse(context?.params.id);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!id.success || !parsed.success) {
      return ApiResponse.badRequest('Invalid supplier-resolution request.');
    }
    try {
      const input = { ...parsed.data, productId: id.data };
      const result =
        input.action === 'TRANSFER'
          ? await transferSupplierProduct(input)
          : input.action === 'ISSUE_CREDIT'
            ? await issueSupplierCredit(input)
            : await applySupplierCredit(input);
      return ApiResponse.success(result, 'Supplier resolution recorded');
    } catch (error) {
      if (error instanceof SupplierResolutionError) {
        return ApiResponse.error(error.message, error.status);
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        ['P2034', 'P2002'].includes(String(error.code))
      ) {
        return ApiResponse.conflict(
          'A concurrent or repeated operation changed this purchase or credit. Refresh and retry with the same request.'
        );
      }
      throw error;
    }
  }
);
