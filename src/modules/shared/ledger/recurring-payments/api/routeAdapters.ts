import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false; error: ZodError };
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

type SafeParseSchema<T> = {
  safeParse: (input: unknown) => SafeParseResult<T>;
};

type RecurringTemplatesService<TCreate, TUpdate, TDelete> = {
  findTemplates: () => Promise<unknown>;
  createTemplate: (input: TCreate) => Promise<unknown>;
  updateTemplate: (id: string, input: TUpdate) => Promise<unknown>;
  deleteTemplate: (input: TDelete) => Promise<unknown>;
};

type RecurringGenerateService<TGenerate> = {
  generateDueDrafts: (input?: TGenerate) => Promise<unknown>;
};

type RecurringDraftsService<TDraftList> = {
  listDrafts: (input: TDraftList) => Promise<unknown>;
};

type RecurringApproveService<TApprove> = {
  approveDraft: (input: TApprove) => Promise<unknown>;
};

type RecurringSkipService<TSkip> = {
  skipDraft: (input: TSkip) => Promise<unknown>;
};

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

const coerceDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
};

const parseDateParam = (value: string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export function createRecurringTemplatesRouteHandlers<
  TCreate extends { nextDueDate?: Date; endDate?: Date | null },
  TUpdate extends { id: string; nextDueDate?: Date; endDate?: Date | null },
  TDelete,
>(config: {
  service: RecurringTemplatesService<TCreate, TUpdate, TDelete>;
  createSchema: SafeParseSchema<TCreate>;
  updateSchema: SafeParseSchema<TUpdate>;
  deleteSchema: SafeParseSchema<TDelete>;
  logPrefix: string;
}) {
  const GET = withErrorHandler(async () => {
    try {
      const items = await config.service.findTemplates();
      return ApiResponse.success(items, 'Recurring payment templates fetched');
    } catch (error) {
      logger.error(
        `Failed to fetch ${config.logPrefix} recurring payment templates`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to fetch recurring payment templates',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  const POST = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json();

      const validation = config.createSchema.safeParse({
        ...((payload as Record<string, unknown>) ?? {}),
        nextDueDate: coerceDate(
          (payload as { nextDueDate?: unknown })?.nextDueDate
        ),
        endDate: (payload as { endDate?: unknown })?.endDate
          ? coerceDate((payload as { endDate?: unknown }).endDate)
          : null,
      });

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const created = await config.service.createTemplate(validation.data);
      return ApiResponse.success(
        created,
        'Recurring payment template created',
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      logger.error(
        `Failed to create ${config.logPrefix} recurring payment template`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to create recurring payment template',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  const PATCH = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json();

      const validation = config.updateSchema.safeParse({
        ...((payload as Record<string, unknown>) ?? {}),
        nextDueDate: coerceDate(
          (payload as { nextDueDate?: unknown })?.nextDueDate
        ),
        endDate:
          (payload as { endDate?: unknown })?.endDate === undefined
            ? undefined
            : (payload as { endDate?: unknown })?.endDate
              ? coerceDate((payload as { endDate?: unknown }).endDate)
              : null,
      });

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const updated = await config.service.updateTemplate(
        validation.data.id,
        validation.data
      );
      return ApiResponse.success(updated, 'Recurring payment template updated');
    } catch (error) {
      logger.error(
        `Failed to update ${config.logPrefix} recurring payment template`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to update recurring payment template',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  const DELETE = withErrorHandler(async (request: NextRequest) => {
    try {
      const searchId = request.nextUrl.searchParams.get('id');
      const body = searchId ? { id: searchId } : await request.json();
      const validation = config.deleteSchema.safeParse(body);

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const deleted = await config.service.deleteTemplate(validation.data);
      return ApiResponse.success(deleted, 'Recurring payment template deleted');
    } catch (error) {
      logger.error(
        `Failed to delete ${config.logPrefix} recurring payment template`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to delete recurring payment template',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return { GET, POST, PATCH, DELETE };
}

export function createRecurringGenerateRouteHandler<TGenerate>(config: {
  service: RecurringGenerateService<TGenerate>;
  schema: SafeParseSchema<TGenerate>;
  logPrefix: string;
}) {
  const POST = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json().catch(() => ({}));
      const validation = config.schema.safeParse({
        upToDate: coerceDate((payload as { upToDate?: unknown })?.upToDate),
      });

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const result = await config.service.generateDueDrafts(validation.data);
      return ApiResponse.success(result, 'Recurring drafts generated');
    } catch (error) {
      logger.error(
        `Failed to generate ${config.logPrefix} recurring payment drafts`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to generate recurring payment drafts',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return { POST };
}

export function createRecurringDraftsRouteHandler<TDraftList>(config: {
  service: RecurringDraftsService<TDraftList>;
  schema: SafeParseSchema<TDraftList>;
  logPrefix: string;
}) {
  const GET = withErrorHandler(async (request: NextRequest) => {
    try {
      const status = request.nextUrl.searchParams.get('status');
      const dueFrom = parseDateParam(
        request.nextUrl.searchParams.get('dueFrom')
      );
      const dueTo = parseDateParam(request.nextUrl.searchParams.get('dueTo'));
      const dueOnOrBefore = parseDateParam(
        request.nextUrl.searchParams.get('dueOnOrBefore')
      );

      const validation = config.schema.safeParse({
        status: status || undefined,
        dueFrom,
        dueTo,
        dueOnOrBefore,
      });

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const drafts = await config.service.listDrafts(validation.data);
      return ApiResponse.success(drafts, 'Recurring payment drafts fetched');
    } catch (error) {
      logger.error(
        `Failed to fetch ${config.logPrefix} recurring payment drafts`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to fetch recurring payment drafts',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return { GET };
}

export function createRecurringApproveRouteHandler<TApprove>(config: {
  service: RecurringApproveService<TApprove>;
  schema: SafeParseSchema<TApprove>;
  logPrefix: string;
}) {
  const POST = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json();
      const validation = config.schema.safeParse(payload);

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const result = await config.service.approveDraft(validation.data);
      return ApiResponse.success(result, 'Recurring payment draft approved');
    } catch (error) {
      logger.error(
        `Failed to approve ${config.logPrefix} recurring payment draft`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to approve recurring payment draft',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return { POST };
}

export function createRecurringSkipRouteHandler<TSkip>(config: {
  service: RecurringSkipService<TSkip>;
  schema: SafeParseSchema<TSkip>;
  logPrefix: string;
}) {
  const POST = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json();
      const validation = config.schema.safeParse(payload);

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          buildValidationErrors(validation.error)
        );
      }

      const result = await config.service.skipDraft(validation.data);
      return ApiResponse.success(result, 'Recurring payment draft skipped');
    } catch (error) {
      logger.error(
        `Failed to skip ${config.logPrefix} recurring payment draft`,
        {
          error,
        }
      );
      return ApiResponse.error(
        'Failed to skip recurring payment draft',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return { POST };
}
