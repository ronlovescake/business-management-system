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
