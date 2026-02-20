import { describe, expect, it } from 'vitest';
import {
  getErrorEnvelopeMarkers,
  getExportedHttpMethods,
  hasValidationMarker,
  intersection,
  listRelativeFilesBySuffix,
  readWorkspaceFile,
} from './parityTestUtils';

const API_BASE_ROOT = 'src/app/api';
const API_GM_ROOT = 'src/app/api/general-merchandise';

describe('LIV-23 API routes parity (base vs GM)', () => {
  const baseRoutes = listRelativeFilesBySuffix(
    API_BASE_ROOT,
    '/route.ts'
  ).filter((routePath) => !routePath.startsWith('general-merchandise/'));
  const gmRoutes = listRelativeFilesBySuffix(API_GM_ROOT, '/route.ts');
  const sharedRelativeRoutes = intersection(baseRoutes, gmRoutes);
  const parityGovernedRoutes = sharedRelativeRoutes.filter(
    (routePath) =>
      routePath.startsWith('accounting/') || routePath.startsWith('payroll/')
  );

  it('keeps a broad set of shared API relative paths', () => {
    expect(sharedRelativeRoutes.length).toBeGreaterThanOrEqual(60);
    expect(parityGovernedRoutes.length).toBeGreaterThanOrEqual(15);
  });

  it('keeps validation and error-envelope equivalence on shared API paths', () => {
    const failures: string[] = [];

    for (const relativeRoutePath of parityGovernedRoutes) {
      const baseSource = readWorkspaceFile(
        `${API_BASE_ROOT}/${relativeRoutePath}`
      );
      const gmSource = readWorkspaceFile(`${API_GM_ROOT}/${relativeRoutePath}`);

      const baseMethods = getExportedHttpMethods(baseSource);
      const gmMethods = getExportedHttpMethods(gmSource);
      if (JSON.stringify(baseMethods) !== JSON.stringify(gmMethods)) {
        failures.push(
          `${relativeRoutePath}: method mismatch base=${baseMethods.join(',')} gm=${gmMethods.join(',')}`
        );
      }

      const baseValidation = hasValidationMarker(baseSource);
      const gmValidation = hasValidationMarker(gmSource);
      if (baseValidation !== gmValidation) {
        failures.push(
          `${relativeRoutePath}: validation marker mismatch base=${baseValidation} gm=${gmValidation}`
        );
      }

      const baseEnvelopeMarkers = getErrorEnvelopeMarkers(baseSource);
      const gmEnvelopeMarkers = getErrorEnvelopeMarkers(gmSource);

      if (!baseEnvelopeMarkers.length || !gmEnvelopeMarkers.length) {
        failures.push(
          `${relativeRoutePath}: missing error-envelope marker on one side`
        );
        continue;
      }

      const sharedMarker = baseEnvelopeMarkers.some((marker) =>
        gmEnvelopeMarkers.includes(marker)
      );

      if (!sharedMarker) {
        failures.push(
          `${relativeRoutePath}: envelope markers diverged base=${baseEnvelopeMarkers.join('|')} gm=${gmEnvelopeMarkers.join('|')}`
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
