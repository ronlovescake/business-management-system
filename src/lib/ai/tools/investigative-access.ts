import type { AiBusinessUnit, AiToolExecutionContext } from '../types';

export function normalizeBusinessUnitArg(raw: unknown): AiBusinessUnit {
  if (raw === 'trucking' || raw === 'general-merchandise') {
    return raw;
  }
  return 'clothing';
}

export function assertBusinessUnitAccessLocal(
  context: AiToolExecutionContext,
  businessUnit: AiBusinessUnit
): void {
  if (!context.allowedBusinessUnits.includes(businessUnit)) {
    throw new Error(
      `Access denied: current user is not authorized to read ${businessUnit} records.`
    );
  }
}
