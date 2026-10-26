import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export class FinancialOperationError extends Error {
  constructor(
    message: string,
    public readonly status = 409
  ) {
    super(message);
    this.name = 'FinancialOperationError';
  }
}

export function financialRequestId(headers: Headers): string {
  const parsed = z.string().uuid().safeParse(headers.get('Idempotency-Key'));
  if (!parsed.success) {
    throw new FinancialOperationError(
      'A valid Idempotency-Key is required to save money safely.',
      400
    );
  }
  return parsed.data;
}

export async function runFinancialTransaction<Result>(
  operation: (transaction: Prisma.TransactionClient) => Promise<Result>
): Promise<Result> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;
      if ((code !== 'P2034' && code !== 'P2002') || attempt === 2) {
        throw error;
      }
    }
  }
  throw new Error('Financial transaction retry limit reached.');
}

export async function runFinancialRequest<Result>(
  requestId: string,
  operation: string,
  payload: unknown,
  work: (
    transaction: Prisma.TransactionClient,
    requestId: string
  ) => Promise<Result>
): Promise<Result> {
  const payloadHash = createHash('sha256')
    .update(JSON.stringify({ operation, payload }))
    .digest('hex');

  return runFinancialTransaction(async (transaction) => {
    const previous = await transaction.clothingFinancialRequest.findUnique({
      where: { id: requestId },
    });
    if (previous) {
      if (
        previous.operation !== operation ||
        previous.payloadHash !== payloadHash
      ) {
        throw new FinancialOperationError(
          'This save key already belongs to different details. Start a new save.'
        );
      }
      if (previous.result === null) {
        throw new FinancialOperationError(
          'This money operation needs review before it can be retried.'
        );
      }
      return previous.result as unknown as Result;
    }

    await transaction.clothingFinancialRequest.create({
      data: { id: requestId, operation, payloadHash },
    });
    const result = await work(transaction, requestId);
    if (result && typeof result === 'object' && 'validationError' in result) {
      await transaction.clothingFinancialRequest.delete({
        where: { id: requestId },
      });
      return result;
    }
    await transaction.clothingFinancialRequest.update({
      where: { id: requestId },
      data: {
        result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
      },
    });
    return result;
  });
}
