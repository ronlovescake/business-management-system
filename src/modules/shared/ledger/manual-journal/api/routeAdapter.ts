import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';

type ManualJournalPayload = {
  sourceId?: string;
  date: string;
  ref: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description?: string;
};

type ManualJournalModel = {
  create?: (args: {
    data: {
      date: Date;
      ref: string;
      account: string;
      debit: number;
      credit: number;
      description: string | null;
      sourceType: 'MANUAL';
      sourceId: string;
      sourceLineKey: 'debit' | 'credit';
      systemGenerated: false;
    };
  }) => Promise<unknown>;
  findMany?: (args: {
    where: Record<string, unknown>;
    select: { sourceLineKey: true };
  }) => Promise<Array<{ sourceLineKey: string }>>;
  updateMany?: (args: {
    where: Record<string, unknown>;
    data: {
      date: Date;
      ref: string;
      account: string;
      debit: number;
      credit: number;
      description: string | null;
    };
  }) => Promise<unknown>;
  deleteMany?: (args: {
    where: Record<string, unknown>;
  }) => Promise<{ count: number }>;
};

type UpdateMode = 'inplace' | 'replace';

type CutoverResolver = Date | (() => Date | Promise<Date>);

type ManualJournalRouteAdapterConfig = {
  cutover: CutoverResolver;
  missingTableResponseDetail: string;
  getModel: (client: unknown) => ManualJournalModel | undefined;
  updateMode: UpdateMode;
  sourceIdRequiredForPutMessage: string;
  sourceIdRequiredForDeleteMessage: string;
  updateMissingEntryMessage: string;
  deleteMissingReturnsNotFound: boolean;
  deleteWhere: (sourceId: string) => Record<string, unknown>;
  replacePutDeleteWhere: (sourceId: string) => Record<string, unknown>;
  inplaceLookupWhere: (sourceId: string) => Record<string, unknown>;
  inplaceDebitWhere: (sourceId: string) => Record<string, unknown>;
  inplaceCreditWhere: (sourceId: string) => Record<string, unknown>;
};

async function resolveCutover(cutover: CutoverResolver): Promise<Date> {
  return typeof cutover === 'function' ? await cutover() : cutover;
}

function normalizedDateOrNull(raw: unknown): Date | null {
  const date = parseDate(typeof raw === 'string' ? raw : null);
  if (!date) {
    return null;
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  return code === 'P2021' || message.includes('does not exist');
}

function validate(
  body: unknown,
  cutover: Date
):
  | { ok: true; value: ManualJournalPayload }
  | { ok: false; errorMessage: string } {
  const payload = (body as Record<string, unknown>) ?? {};

  const sourceId = (payload.sourceId ?? '').toString().trim();
  const date = (payload.date ?? '').toString().trim();
  const ref = (payload.ref ?? '').toString().trim();
  const debitAccount = (payload.debitAccount ?? '').toString().trim();
  const creditAccount = (payload.creditAccount ?? '').toString().trim();
  const amount = Number(payload.amount ?? 0);
  const description = (payload.description ?? '').toString().trim();

  if (!date) {
    return { ok: false, errorMessage: 'Date is required.' };
  }

  if (!ref) {
    return { ok: false, errorMessage: 'Reference is required.' };
  }

  if (!debitAccount || !creditAccount) {
    return {
      ok: false,
      errorMessage: 'Debit and credit accounts are required.',
    };
  }

  if (debitAccount === creditAccount) {
    return {
      ok: false,
      errorMessage: 'Debit and credit accounts must be different.',
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, errorMessage: 'Amount must be a positive number.' };
  }

  const normalizedDate = normalizedDateOrNull(date);
  if (!normalizedDate) {
    return { ok: false, errorMessage: 'Date must be a valid date.' };
  }

  if (normalizedDate < cutover) {
    const cutoverLabel = cutover.toISOString().slice(0, 10);
    return {
      ok: false,
      errorMessage: `Manual journal entries are only allowed from ${cutoverLabel} onward.`,
    };
  }

  return {
    ok: true,
    value: {
      sourceId: sourceId || undefined,
      date,
      ref,
      debitAccount,
      creditAccount,
      amount,
      description: description || undefined,
    },
  };
}

function missingTableResponse(detail: string) {
  return ApiResponse.error(
    'Manual journal entries are not enabled in this database yet',
    503,
    detail
  );
}

function buildEntryResponse(value: {
  sourceId: string;
  entryDate: Date;
  ref: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
  description?: string;
}) {
  return {
    entry: {
      sourceId: value.sourceId,
      date: value.entryDate.toISOString(),
      ref: value.ref,
      amount: value.amount,
      debitAccount: value.debitAccount,
      creditAccount: value.creditAccount,
      description: value.description || '',
    },
  };
}

function requireModel(
  client: unknown,
  getModel: (client: unknown) => ManualJournalModel | undefined
): ManualJournalModel {
  const model = getModel(client);
  if (!model) {
    throw new Error('Manual journal model is not available');
  }
  return model;
}

export function createManualJournalRouteHandlers(
  prismaClient: {
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  },
  config: ManualJournalRouteAdapterConfig
) {
  const POST = withErrorHandler(async (req: NextRequest) => {
    const cutover = await resolveCutover(config.cutover);
    const body = (await req.json().catch(() => null)) ?? {};
    const validation = validate(body, cutover);
    if (!validation.ok) {
      return ApiResponse.badRequest(validation.errorMessage);
    }

    const { date, ref, debitAccount, creditAccount, amount, description } =
      validation.value;

    const entryDate = normalizedDateOrNull(date);
    if (!entryDate) {
      return ApiResponse.badRequest('Date must be a valid date.');
    }

    const sourceId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      await prismaClient.$transaction(async (tx) => {
        const model = requireModel(tx, config.getModel);
        if (!model.create) {
          throw new Error('Manual journal model create() is not available');
        }

        await model.create({
          data: {
            date: entryDate,
            ref,
            account: debitAccount,
            debit: amount,
            credit: 0,
            description: description || null,
            sourceType: 'MANUAL',
            sourceId,
            sourceLineKey: 'debit',
            systemGenerated: false,
          },
        });

        await model.create({
          data: {
            date: entryDate,
            ref,
            account: creditAccount,
            debit: 0,
            credit: amount,
            description: description || null,
            sourceType: 'MANUAL',
            sourceId,
            sourceLineKey: 'credit',
            systemGenerated: false,
          },
        });
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return missingTableResponse(config.missingTableResponseDetail);
      }
      throw error;
    }

    return ApiResponse.success(
      buildEntryResponse({
        sourceId,
        entryDate,
        ref,
        amount,
        debitAccount,
        creditAccount,
        description,
      }),
      'Manual journal entry saved'
    );
  });

  const PUT = withErrorHandler(async (req: NextRequest) => {
    const cutover = await resolveCutover(config.cutover);
    const body = (await req.json().catch(() => null)) ?? {};
    const validation = validate(body, cutover);
    if (!validation.ok) {
      return ApiResponse.badRequest(validation.errorMessage);
    }

    const {
      sourceId,
      date,
      ref,
      debitAccount,
      creditAccount,
      amount,
      description,
    } = validation.value;

    if (!sourceId) {
      return ApiResponse.badRequest(config.sourceIdRequiredForPutMessage);
    }

    const entryDate = normalizedDateOrNull(date);
    if (!entryDate) {
      return ApiResponse.badRequest('Date must be a valid date.');
    }

    try {
      const updated = await prismaClient.$transaction(async (tx) => {
        const model = requireModel(tx, config.getModel);

        if (config.updateMode === 'inplace') {
          if (!model.findMany || !model.updateMany) {
            throw new Error(
              'Manual journal model required methods are missing'
            );
          }

          const existing = await model.findMany({
            where: config.inplaceLookupWhere(sourceId),
            select: { sourceLineKey: true },
          });

          const hasDebit = existing.some(
            (row) => row.sourceLineKey === 'debit'
          );
          const hasCredit = existing.some(
            (row) => row.sourceLineKey === 'credit'
          );
          if (!hasDebit || !hasCredit) {
            return false;
          }

          await model.updateMany({
            where: config.inplaceDebitWhere(sourceId),
            data: {
              date: entryDate,
              ref,
              account: debitAccount,
              debit: amount,
              credit: 0,
              description: description || null,
            },
          });

          await model.updateMany({
            where: config.inplaceCreditWhere(sourceId),
            data: {
              date: entryDate,
              ref,
              account: creditAccount,
              debit: 0,
              credit: amount,
              description: description || null,
            },
          });

          return true;
        }

        if (!model.deleteMany || !model.create) {
          throw new Error('Manual journal model required methods are missing');
        }

        const deleted = await model.deleteMany({
          where: config.replacePutDeleteWhere(sourceId),
        });

        if (!deleted.count) {
          throw new Error(config.updateMissingEntryMessage);
        }

        await model.create({
          data: {
            date: entryDate,
            ref,
            account: debitAccount,
            debit: amount,
            credit: 0,
            description: description || null,
            sourceType: 'MANUAL',
            sourceId,
            sourceLineKey: 'debit',
            systemGenerated: false,
          },
        });

        await model.create({
          data: {
            date: entryDate,
            ref,
            account: creditAccount,
            debit: 0,
            credit: amount,
            description: description || null,
            sourceType: 'MANUAL',
            sourceId,
            sourceLineKey: 'credit',
            systemGenerated: false,
          },
        });

        return true;
      });

      if (!updated) {
        return ApiResponse.notFound('Manual journal entry');
      }
    } catch (error) {
      if (isMissingTableError(error)) {
        return missingTableResponse(config.missingTableResponseDetail);
      }
      if (config.updateMode === 'replace' && error instanceof Error) {
        return ApiResponse.badRequest(error.message);
      }
      throw error;
    }

    return ApiResponse.success(
      buildEntryResponse({
        sourceId,
        entryDate,
        ref,
        amount,
        debitAccount,
        creditAccount,
        description,
      }),
      'Manual journal entry updated'
    );
  });

  const DELETE = withErrorHandler(async (req: NextRequest) => {
    const sourceId = req.nextUrl.searchParams.get('sourceId')?.trim() ?? '';
    if (!sourceId) {
      return ApiResponse.badRequest(config.sourceIdRequiredForDeleteMessage);
    }

    try {
      const model = requireModel(prismaClient, config.getModel);
      if (!model.deleteMany) {
        return missingTableResponse(config.missingTableResponseDetail);
      }

      const result = await model.deleteMany({
        where: config.deleteWhere(sourceId),
      });

      if (config.deleteMissingReturnsNotFound && !result.count) {
        return ApiResponse.notFound('Manual journal entry');
      }
    } catch (error) {
      if (isMissingTableError(error)) {
        return missingTableResponse(config.missingTableResponseDetail);
      }
      throw error;
    }

    return ApiResponse.success({ sourceId }, 'Manual journal entry deleted');
  });

  return { POST, PUT, DELETE };
}
