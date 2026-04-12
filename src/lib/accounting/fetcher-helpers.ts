import { logger } from '@/lib/logger';

type FetchWithFallbackOptions<T> = {
  fetchWithChanges: () => Promise<T[]>;
  fetchWithoutChanges: () => Promise<T[]>;
  logMessage: string;
  logContext?: Record<string, unknown>;
};

export async function fetchWithStatusChangesFallback<T>(
  options: FetchWithFallbackOptions<T>
): Promise<T[]> {
  try {
    return await options.fetchWithChanges();
  } catch (error) {
    logger.warn(options.logMessage, {
      error,
      ...(options.logContext ?? {}),
    });
    return await options.fetchWithoutChanges();
  }
}

export type StatusChangeStamp = {
  newStatus: string | null;
  changedAt: Date;
};

type FindManyModel = {
  findMany?: (args: unknown) => Promise<unknown>;
};

type FetchOptionalModelRowsOptions<T> = {
  model: FindManyModel | undefined;
  unavailableLogMessage: string;
  unavailableHint: string;
  query: () => Promise<T[]>;
  missingTableLogMessage?: string;
  missingTableHint?: string;
  errorLogMessage?: string;
};

export function findChangedAtForStatuses(
  statusChanges: StatusChangeStamp[] | undefined,
  statuses: readonly string[]
): Date | null {
  return (
    statusChanges?.find((status) =>
      statuses.includes((status.newStatus ?? '').trim())
    )?.changedAt ?? null
  );
}

export function getCancelledAtDateFromStatusChanges(tx: {
  statusChanges?: StatusChangeStamp[];
  updatedAt?: Date;
}): Date | null {
  if (!tx.statusChanges || tx.statusChanges.length === 0) {
    return tx.updatedAt ?? null;
  }

  const forfeited = findChangedAtForStatuses(tx.statusChanges, ['Forfeited']);
  if (forfeited) {
    return forfeited;
  }

  return (
    findChangedAtForStatuses(tx.statusChanges, ['Cancelled']) ??
    tx.updatedAt ??
    null
  );
}

export function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  return code === 'P2021' || message.includes('does not exist');
}

export async function fetchOptionalModelRows<T>(
  options: FetchOptionalModelRowsOptions<T>
): Promise<T[]> {
  if (!options.model?.findMany) {
    logger.warn(options.unavailableLogMessage, {
      hint: options.unavailableHint,
    });
    return [];
  }

  try {
    return await options.query();
  } catch (error) {
    if (options.missingTableLogMessage && isMissingTableError(error)) {
      logger.warn(options.missingTableLogMessage, {
        hint: options.missingTableHint,
      });
      return [];
    }

    if (options.errorLogMessage) {
      logger.error(options.errorLogMessage, { error });
    }

    throw error;
  }
}
