import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDateRangeFromParams } from '@/lib/accounting/date-utils';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';

export type OpeningBalanceEntry = {
  id: string;
  date: Date;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string | null;
};

export type OpeningBalanceModel = {
  findMany?: (args: {
    where: {
      date?: { gte?: Date; lte?: Date };
      // Soft-delete column added 2026-04-19; reads filter `deletedAt: null`.
      deletedAt?: null;
    };
    orderBy: { date: 'asc' };
  }) => Promise<OpeningBalanceEntry[]>;
  create?: (args: {
    data: {
      date: Date;
      ref: string;
      account: string;
      debit: number;
      credit: number;
      description: string | null;
    };
  }) => Promise<OpeningBalanceEntry>;
  update?: (args: {
    where: { id: string };
    data:
      | {
          date: Date;
          ref: string;
          account: string;
          debit: number;
          credit: number;
          description: string | null;
        }
      | { deletedAt: Date };
  }) => Promise<OpeningBalanceEntry>;
  delete?: (args: { where: { id: string } }) => Promise<unknown>;
};

type OpeningBalanceBatchValue = {
  id?: string;
  account: string;
  ref: string;
  description: string | null;
  debit: number;
  credit: number;
};

type OpeningBalanceAdapterConfig = {
  cutover: Date | (() => Date | Promise<Date>);
  getModel: () => OpeningBalanceModel | undefined;
  runInTransaction?: <T>(
    work: (model: OpeningBalanceModel) => Promise<T>
  ) => Promise<T>;
  modelUnavailableMessage: string;
  modelUnavailableDetail: string;
  getReturnsEmptyWhenModelMissing: boolean;
};

async function resolveCutover(
  cutover: OpeningBalanceAdapterConfig['cutover']
): Promise<Date> {
  return typeof cutover === 'function' ? await cutover() : cutover;
}

function serialize(entry: OpeningBalanceEntry) {
  return {
    id: entry.id,
    date: entry.date.toISOString(),
    ref: entry.ref,
    account: normalizeAccountForReporting(entry.account),
    debit: entry.debit,
    credit: entry.credit,
    description: entry.description ?? '',
  };
}

function normalizedCutoverDate(cutover: Date) {
  return new Date(
    Date.UTC(
      cutover.getUTCFullYear(),
      cutover.getUTCMonth(),
      cutover.getUTCDate()
    )
  );
}

function validateOpeningBalancePayload(body: unknown):
  | {
      ok: true;
      value: {
        account: string;
        ref: string;
        description: string | null;
        debit: number;
        credit: number;
      };
    }
  | { ok: false; errorMessage: string } {
  const payload = (body as Record<string, unknown>) ?? {};

  const account = normalizeAccountForReporting(
    (payload.account ?? '').toString().trim()
  ).trim();
  const ref = ((payload.ref as string) ?? '').trim() || 'OPENING';
  const description = ((payload.description as string) ?? '').trim();
  const debit = Number(payload.debit ?? 0);
  const credit = Number(payload.credit ?? 0);

  if (!account) {
    return { ok: false, errorMessage: 'Account is required.' };
  }

  if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
    return { ok: false, errorMessage: 'Amounts must be valid numbers.' };
  }

  if (debit > 0 && credit > 0) {
    return {
      ok: false,
      errorMessage: 'Provide either a debit or a credit, not both.',
    };
  }

  if (debit <= 0 && credit <= 0) {
    return {
      ok: false,
      errorMessage: 'Provide a debit or a credit amount.',
    };
  }

  return {
    ok: true,
    value: {
      account,
      ref,
      description: description || null,
      debit: debit > 0 ? debit : 0,
      credit: credit > 0 ? credit : 0,
    },
  };
}

function validateOpeningBalanceBatch(
  body: unknown,
  allowExistingIds: boolean
):
  | { ok: true; values: OpeningBalanceBatchValue[] }
  | { ok: false; errorMessage: string } {
  const payload = (body as Record<string, unknown>) ?? {};
  const rawEntries = payload.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length < 2) {
    return {
      ok: false,
      errorMessage: 'At least two balanced opening balance lines are required.',
    };
  }

  const values: OpeningBalanceBatchValue[] = [];
  for (const rawEntry of rawEntries) {
    const validation = validateOpeningBalancePayload(rawEntry);
    if (!validation.ok) {
      return validation;
    }

    const entry = (rawEntry as Record<string, unknown>) ?? {};
    const id = String(entry.id ?? '').trim();
    if (id && !allowExistingIds) {
      return {
        ok: false,
        errorMessage: 'New opening balance lines cannot include ids.',
      };
    }

    values.push({ ...validation.value, ...(id ? { id } : {}) });
  }

  if (allowExistingIds && !values.some((entry) => entry.id)) {
    return {
      ok: false,
      errorMessage: 'At least one opening balance id is required for updates.',
    };
  }

  const totalDebit = values.reduce((total, entry) => total + entry.debit, 0);
  const totalCredit = values.reduce((total, entry) => total + entry.credit, 0);
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    return {
      ok: false,
      errorMessage: 'Opening balance lines must have equal debits and credits.',
    };
  }

  return { ok: true, values };
}

function modelUnavailable(config: OpeningBalanceAdapterConfig) {
  return ApiResponse.error(
    config.modelUnavailableMessage,
    503,
    config.modelUnavailableDetail
  );
}

export function createOpeningBalanceRouteHandlers(
  config: OpeningBalanceAdapterConfig
) {
  const GET = withErrorHandler(async (req: NextRequest) => {
    const cutover = await resolveCutover(config.cutover);
    const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);

    const where: {
      date?: { gte?: Date; lte?: Date };
      deletedAt?: null;
    } = {
      // Filter out soft-deleted opening balances (column added 2026-04-19).
      deletedAt: null,
    };
    if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const model = config.getModel();

    if (!model?.findMany && !config.getReturnsEmptyWhenModelMissing) {
      return modelUnavailable(config);
    }

    const entries = model?.findMany
      ? await model.findMany({ where, orderBy: { date: 'asc' } })
      : [];

    return ApiResponse.success({
      cutoverDate: normalizedCutoverDate(cutover).toISOString().slice(0, 10),
      entries: entries.map(serialize),
    });
  });

  const POST = withErrorHandler(async (req: NextRequest) => {
    const cutover = await resolveCutover(config.cutover);
    const body = (await req.json().catch(() => null)) ?? {};

    if (Array.isArray((body as Record<string, unknown>).entries)) {
      const batch = validateOpeningBalanceBatch(body, false);
      if (!batch.ok) {
        return ApiResponse.badRequest(batch.errorMessage);
      }

      if (!config.runInTransaction) {
        return ApiResponse.error(
          'Atomic opening balance posting is unavailable.',
          503
        );
      }

      const entries = await config.runInTransaction(async (model) => {
        const create = model.create;
        if (!create) {
          throw new Error('Opening balance create is unavailable.');
        }

        return Promise.all(
          batch.values.map((entry) =>
            create({
              data: {
                date: normalizedCutoverDate(cutover),
                ref: entry.ref,
                account: entry.account,
                debit: entry.debit,
                credit: entry.credit,
                description: entry.description,
              },
            })
          )
        );
      });

      return ApiResponse.success(
        { entries: entries.map(serialize) },
        'Opening balance entry saved'
      );
    }

    const validation = validateOpeningBalancePayload(body);
    if (!validation.ok) {
      return ApiResponse.badRequest(validation.errorMessage);
    }

    const model = config.getModel();
    if (!model?.create) {
      return modelUnavailable(config);
    }

    const { account, ref, description, debit, credit } = validation.value;
    const entry = await model.create({
      data: {
        date: normalizedCutoverDate(cutover),
        ref,
        account,
        debit,
        credit,
        description,
      },
    });

    return ApiResponse.success(
      { entry: serialize(entry) },
      'Opening balance entry saved'
    );
  });

  const PUT = withErrorHandler(async (req: NextRequest) => {
    const cutover = await resolveCutover(config.cutover);
    const body = (await req.json().catch(() => null)) ?? {};

    if (Array.isArray((body as Record<string, unknown>).entries)) {
      const batch = validateOpeningBalanceBatch(body, true);
      if (!batch.ok) {
        return ApiResponse.badRequest(batch.errorMessage);
      }

      if (!config.runInTransaction) {
        return ApiResponse.error(
          'Atomic opening balance updates are unavailable.',
          503
        );
      }

      const entries = await config.runInTransaction(async (model) => {
        const update = model.update;
        const create = model.create;
        if (!update || !create) {
          throw new Error('Opening balance writes are unavailable.');
        }

        return Promise.all(
          batch.values.map((entry) => {
            const data = {
              date: normalizedCutoverDate(cutover),
              ref: entry.ref,
              account: entry.account,
              debit: entry.debit,
              credit: entry.credit,
              description: entry.description,
            };

            return entry.id
              ? update({ where: { id: entry.id }, data })
              : create({ data });
          })
        );
      });

      return ApiResponse.success(
        { entries: entries.map(serialize) },
        'Opening balance entry updated'
      );
    }

    const id = (body.id ?? '').trim();

    if (!id) {
      return ApiResponse.badRequest('Opening balance id is required.');
    }

    const validation = validateOpeningBalancePayload(body);
    if (!validation.ok) {
      return ApiResponse.badRequest(validation.errorMessage);
    }

    const model = config.getModel();
    if (!model?.update) {
      return modelUnavailable(config);
    }

    const { account, ref, description, debit, credit } = validation.value;
    const entry = await model.update({
      where: { id },
      data: {
        date: normalizedCutoverDate(cutover),
        ref,
        account,
        debit,
        credit,
        description,
      },
    });

    return ApiResponse.success(
      { entry: serialize(entry) },
      'Opening balance entry updated'
    );
  });

  const DELETE = withErrorHandler(async (req: NextRequest) => {
    const ids = req.nextUrl.searchParams
      .getAll('id')
      .map((id) => id.trim())
      .filter(Boolean);
    const id = ids[0] ?? '';

    if (!id) {
      return ApiResponse.badRequest('Opening balance id is required.');
    }

    const model = config.getModel();
    if (ids.length > 1) {
      if (!config.runInTransaction) {
        return ApiResponse.error(
          'Atomic opening balance deletion is unavailable.',
          503
        );
      }
      if (!model?.update) {
        return modelUnavailable(config);
      }

      await config.runInTransaction(async (transactionModel) => {
        const update = transactionModel.update;
        if (!update) {
          throw new Error('Opening balance update is unavailable.');
        }
        const deletedAt = new Date();
        await Promise.all(
          Array.from(new Set(ids)).map((entryId) =>
            update({
              where: { id: entryId },
              data: { deletedAt },
            })
          )
        );
      });

      return ApiResponse.success({ ids }, 'Opening balance entries deleted');
    }

    // Prefer soft-delete via update so the opening-balance row history is
    // preserved (deletedAt column added 2026-04-19). Fall back to hard delete
    // only if update is unavailable on this delegate.
    if (model?.update) {
      await model.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return ApiResponse.success({ id }, 'Opening balance entry deleted');
    }

    if (!model?.delete) {
      return modelUnavailable(config);
    }

    await model.delete({ where: { id } });
    return ApiResponse.success({ id }, 'Opening balance entry deleted');
  });

  return { GET, POST, PUT, DELETE };
}
