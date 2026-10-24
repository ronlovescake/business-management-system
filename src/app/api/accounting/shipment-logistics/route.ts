import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  getLogisticsBalances,
  logisticsAmountLimit,
  logisticsLineKey,
  LOGISTICS_ACTIONS,
  LOGISTICS_VENDORS,
  parseLogisticsLineKey,
} from '@/modules/clothing/operations/shipments/lib/logisticsCosts';

const sourceType = 'SHIPMENT_LOGISTICS';
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
const postingSchema = z
  .object({
    requestId: z.string().uuid(),
    shipmentId: z.number().int().positive(),
    vendor: z.enum(LOGISTICS_VENDORS),
    action: z.enum(LOGISTICS_ACTIONS),
    date: dateSchema,
    amount: z
      .number()
      .finite()
      .positive()
      .max(Number.MAX_SAFE_INTEGER / 100)
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001
      ),
    ref: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(''),
    clearingAccount: z.string().trim().min(1).max(255),
    payableAccount: z.string().trim().min(1).max(255),
  })
  .refine(
    (value) =>
      value.clearingAccount !== value.payableAccount &&
      !['Cash', 'Stock on Hand'].includes(value.clearingAccount) &&
      !['Cash', 'Stock on Hand'].includes(value.payableAccount),
    {
      message:
        'Clearing and payable accounts must be distinct from each other, Cash and Stock on Hand.',
    }
  );

export const POST = withErrorHandler(async (request: NextRequest) => {
  const parsed = postingSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return ApiResponse.badRequest(
      'Invalid actual logistics posting',
      Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join('.') || 'posting',
          issue.message,
        ])
      )
    );
  }
  const input = parsed.data;
  const date = new Date(`${input.date}T00:00:00Z`);
  if (date < (await getRuntimeAccountingCutoverDate('clothing'))) {
    return ApiResponse.badRequest(
      'Posting date is before the clothing accounting cutover'
    );
  }

  const accounts = {
    accrue: [input.clearingAccount, input.payableAccount],
    pay: [input.payableAccount, 'Cash'],
    capitalize: ['Stock on Hand', input.clearingAccount],
    'adjust-down': [input.payableAccount, input.clearingAccount],
  };
  const [debitAccount, creditAccount] = accounts[input.action];
  const sourceId = `logistics:${input.requestId}`;
  const debitKey = logisticsLineKey(
    input.shipmentId,
    input.vendor,
    input.action,
    'debit'
  );
  const creditKey = logisticsLineKey(
    input.shipmentId,
    input.vendor,
    input.action,
    'credit'
  );

  try {
    return await prisma.$transaction(
      async (client) => {
        const existing = await client.clothingAccountingJournalLine.findMany({
          where: { sourceType, sourceId, deletedAt: null },
        });
        if (existing.length) {
          const debit = existing.find(
            (line) => line.sourceLineKey === debitKey
          );
          const credit = existing.find(
            (line) => line.sourceLineKey === creditKey
          );
          const matches =
            existing.length === 2 &&
            debit &&
            credit &&
            debit.debit === input.amount &&
            debit.credit === 0 &&
            credit.credit === input.amount &&
            credit.debit === 0 &&
            debit.account === debitAccount &&
            credit.account === creditAccount &&
            existing.every(
              (line) =>
                line.date.getTime() === date.getTime() &&
                line.ref === input.ref &&
                (line.description ?? '') === input.description
            );
          return matches
            ? ApiResponse.success(
                { sourceId, reused: true },
                'Actual logistics posting already saved'
              )
            : ApiResponse.conflict(
                'This retry key belongs to a different logistics posting'
              );
        }

        const shipment = await client.shipment.findFirst({
          where: { id: input.shipmentId, deletedAt: null },
        });
        if (!shipment) {
          return ApiResponse.notFound('Shipment');
        }
        if (
          input.action === 'capitalize' &&
          shipment.shipmentStatus !== 'Delivered'
        ) {
          return ApiResponse.conflict(
            'Logistics can only be capitalized after the shipment is Delivered'
          );
        }
        if (input.action === 'capitalize' && shipment.dateDelivered) {
          const deliveredDate = new Date(shipment.dateDelivered);
          if (
            Number.isFinite(deliveredDate.getTime()) &&
            date.getTime() <
              new Date(deliveredDate.toISOString().slice(0, 10)).getTime()
          ) {
            return ApiResponse.badRequest(
              'Capitalization date cannot be before the delivery date'
            );
          }
        }

        const legacy = await client.clothingAccountingJournalLine.findFirst({
          where: {
            sourceType: 'MANUAL',
            deletedAt: null,
            OR: [
              { ref: { in: [shipment.shipmentCode, input.ref] } },
              { description: { contains: shipment.shipmentCode } },
            ],
          },
          select: { id: true },
        });
        if (legacy) {
          return ApiResponse.conflict(
            'Existing manual journals require review before guided logistics posting. No history has been changed.'
          );
        }

        const lines = await client.clothingAccountingJournalLine.findMany({
          where: {
            sourceType,
            deletedAt: null,
            sourceLineKey: { startsWith: `shipment:${input.shipmentId}:` },
          },
        });
        const vendorLines = lines.filter(
          (line) =>
            parseLogisticsLineKey(line.sourceLineKey)?.vendor === input.vendor
        );
        const accruals = vendorLines.filter(
          (line) =>
            parseLogisticsLineKey(line.sourceLineKey)?.action === 'accrue'
        );
        if (
          accruals.some(
            (line) =>
              (line.debit > 0 && line.account !== input.clearingAccount) ||
              (line.credit > 0 && line.account !== input.payableAccount)
          )
        ) {
          return ApiResponse.conflict(
            "Account names differ from this vendor's existing actual-cost entries; review before posting"
          );
        }

        const balances = getLogisticsBalances(lines, input.vendor);
        const limit = logisticsAmountLimit(input.action, balances);
        if (Math.round(input.amount * 100) > Math.round(limit * 100)) {
          return ApiResponse.conflict(
            `Amount exceeds the remaining ${input.action === 'pay' ? 'payable' : 'uncapitalized/correctable'} balance (${limit.toFixed(2)})`
          );
        }

        const common = {
          sourceType,
          sourceId,
          systemGenerated: true,
          date,
          ref: input.ref,
          description: input.description || null,
        };
        await client.clothingAccountingJournalLine.create({
          data: {
            ...common,
            sourceLineKey: debitKey,
            account: debitAccount,
            debit: input.amount,
            credit: 0,
          },
        });
        await client.clothingAccountingJournalLine.create({
          data: {
            ...common,
            sourceLineKey: creditKey,
            account: creditAccount,
            debit: 0,
            credit: input.amount,
          },
        });
        return ApiResponse.success(
          { sourceId, reused: false },
          'Actual logistics posting saved',
          201
        );
      },
      { isolationLevel: 'Serializable', timeout: 30000 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    ) {
      return ApiResponse.conflict(
        'Logistics changed concurrently; refresh and retry with the same request key'
      );
    }
    throw error;
  }
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const shipmentId = Number(request.nextUrl.searchParams.get('shipmentId'));
  if (!Number.isSafeInteger(shipmentId) || shipmentId <= 0) {
    return ApiResponse.badRequest('Valid shipmentId is required');
  }
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, deletedAt: null },
  });
  if (!shipment) {
    return ApiResponse.notFound('Shipment');
  }
  const lines = await prisma.clothingAccountingJournalLine.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
          sourceType,
          sourceLineKey: { startsWith: `shipment:${shipmentId}:` },
        },
        {
          sourceType: 'MANUAL',
          OR: [
            { ref: shipment.shipmentCode },
            { description: { contains: shipment.shipmentCode } },
          ],
        },
      ],
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  return ApiResponse.success({
    lines,
    requiresReview: lines.some((line) => line.sourceType === 'MANUAL'),
  });
});
