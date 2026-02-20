import { describe, expect, it } from 'vitest';
import { getExportedHttpMethods, readWorkspaceFile } from './parityTestUtils';

const BASE_API_ROOT = 'src/app/api';
const GM_API_ROOT = 'src/app/api/general-merchandise';

const LEDGER_ROUTE_PAIRS = [
  {
    relativePath: 'accounting/recurring-payments/templates/route.ts',
    expectedAdapter: 'createRecurringTemplatesRouteHandlers',
  },
  {
    relativePath: 'accounting/recurring-payments/generate/route.ts',
    expectedAdapter: 'createRecurringGenerateRouteHandler',
  },
  {
    relativePath: 'accounting/recurring-payments/drafts/route.ts',
    expectedAdapter: 'createRecurringDraftsRouteHandler',
  },
  {
    relativePath: 'accounting/recurring-payments/drafts/approve/route.ts',
    expectedAdapter: 'createRecurringApproveRouteHandler',
  },
  {
    relativePath: 'accounting/recurring-payments/drafts/skip/route.ts',
    expectedAdapter: 'createRecurringSkipRouteHandler',
  },
  {
    relativePath: 'accounting/opening-balance/route.ts',
    expectedAdapter: 'createOpeningBalanceRouteHandlers',
  },
  {
    relativePath: 'accounting/manual-journal/route.ts',
    expectedAdapter: 'createManualJournalRouteHandlers',
  },
] as const;

describe('LIV-25 module-ledger parity regressions (clothing vs GM)', () => {
  it('keeps recurring/opening/manual route handlers aligned between families', () => {
    const failures: string[] = [];

    for (const routePair of LEDGER_ROUTE_PAIRS) {
      const baseSource = readWorkspaceFile(
        `${BASE_API_ROOT}/${routePair.relativePath}`
      );
      const gmSource = readWorkspaceFile(
        `${GM_API_ROOT}/${routePair.relativePath}`
      );

      if (!baseSource.includes(routePair.expectedAdapter)) {
        failures.push(
          `${routePair.relativePath}: base route missing adapter ${routePair.expectedAdapter}`
        );
      }

      if (!gmSource.includes(routePair.expectedAdapter)) {
        failures.push(
          `${routePair.relativePath}: GM route missing adapter ${routePair.expectedAdapter}`
        );
      }

      const baseMethods = getExportedHttpMethods(baseSource);
      const gmMethods = getExportedHttpMethods(gmSource);
      if (JSON.stringify(baseMethods) !== JSON.stringify(gmMethods)) {
        failures.push(
          `${routePair.relativePath}: method mismatch base=${baseMethods.join(',')} gm=${gmMethods.join(',')}`
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
