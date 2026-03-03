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
    where: { date?: { gte?: Date; lte?: Date } };
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
    data: {
      date: Date;
      ref: string;
      account: string;
      debit: number;
      credit: number;
      description: string | null;
    };
  }) => Promise<OpeningBalanceEntry>;
  delete?: (args: { where: { id: string } }) => Promise<unknown>;
};

type OpeningBalanceAdapterConfig = {
  cutover: Date | (() => Date | Promise<Date>);
  getModel: () => OpeningBalanceModel | undefined;
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

    const where: { date?: { gte?: Date; lte?: Date } } = {};
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
    const id = (req.nextUrl.searchParams.get('id') ?? '').trim();

    if (!id) {
      return ApiResponse.badRequest('Opening balance id is required.');
    }

    const model = config.getModel();
    if (!model?.delete) {
      return modelUnavailable(config);
    }

    await model.delete({ where: { id } });
    return ApiResponse.success({ id }, 'Opening balance entry deleted');
  });

  return { GET, POST, PUT, DELETE };
}
