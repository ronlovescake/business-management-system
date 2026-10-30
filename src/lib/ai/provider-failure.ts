import type { AiProviderFailureDiagnostics } from './types';

export function describeProviderFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/timeout|timed out|time out/i.test(message)) {
    return 'Provider request timed out.';
  }
  if (/quota|rate.?limit|429|capacity/i.test(message)) {
    return 'Provider quota or capacity limit reached.';
  }
  if (
    /auth|credential|invalid.*token|token.*(?:expired|invalid)|restricted|access denied|401|403/i.test(
      message
    )
  ) {
    return 'Provider authentication or authorization failed.';
  }
  if (/not configured|configuration/i.test(message)) {
    return 'Provider configuration is unavailable or invalid.';
  }
  if (/maximum.*tool calls|tool.*limit/i.test(message)) {
    return 'Provider exceeded the allowed tool-call limit.';
  }
  return 'Provider request failed before a usable response was returned.';
}

export function getProviderFailureDiagnostics(
  error: unknown
): AiProviderFailureDiagnostics | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const raw = Reflect.get(error, 'providerDiagnostics');
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const data = raw as Record<string, unknown>;
  const phase = data.phase;
  if (
    phase !== 'runtime-start' &&
    phase !== 'session-setup' &&
    phase !== 'model-response' &&
    phase !== 'tool-execution'
  ) {
    return undefined;
  }
  if (
    ![data.elapsedMs, data.toolCallsStarted, data.toolCallsCompleted].every(
      (value) =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0
    )
  ) {
    return undefined;
  }
  return {
    phase,
    elapsedMs: Number(data.elapsedMs),
    toolCallsStarted: Number(data.toolCallsStarted),
    toolCallsCompleted: Number(data.toolCallsCompleted),
    activeToolNames: Array.isArray(data.activeToolNames)
      ? data.activeToolNames
          .filter(
            (name): name is string =>
              typeof name === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(name)
          )
          .slice(0, 12)
      : [],
  };
}
