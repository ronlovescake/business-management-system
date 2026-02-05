import { logger } from '@/lib/logger';

type MicroBenchmarkOptions = {
  thresholdMs?: number;
  metadata?: Record<string, unknown>;
};

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function runMicroBenchmark<T>(
  name: string,
  fn: () => T,
  options: MicroBenchmarkOptions = {}
): T {
  if (process.env.NODE_ENV !== 'development') {
    return fn();
  }

  const start = now();
  const result = fn();
  const durationMs = now() - start;
  const thresholdMs = options.thresholdMs ?? 8;

  if (durationMs >= thresholdMs) {
    logger.debug('HookBenchmark', `${name} took ${durationMs.toFixed(2)}ms`, {
      durationMs,
      ...options.metadata,
    });
  }

  return result;
}
