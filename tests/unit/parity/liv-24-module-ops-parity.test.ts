import { describe, expect, it } from 'vitest';
import {
  intersection,
  listRelativeFilesBySuffix,
  readWorkspaceFile,
} from './parityTestUtils';

const CLOTHING_OPS_ROOT = 'src/modules/clothing/operations';
const GM_OPS_ROOT = 'src/modules/general-merchandise/operations';

describe('LIV-24 module-ops parity (clothing vs GM)', () => {
  const clothingModuleConfigs = listRelativeFilesBySuffix(
    CLOTHING_OPS_ROOT,
    '/module.config.ts'
  );
  const gmModuleConfigs = listRelativeFilesBySuffix(
    GM_OPS_ROOT,
    '/module.config.ts'
  );

  const sharedModuleConfigs = intersection(
    clothingModuleConfigs,
    gmModuleConfigs
  );

  it('keeps shared module-config surfaces across operations families', () => {
    expect(sharedModuleConfigs.length).toBeGreaterThanOrEqual(10);
  });

  it('keeps shared-helper contracts aligned on shared operations module configs', () => {
    const failures: string[] = [];

    for (const relativeConfigPath of sharedModuleConfigs) {
      const clothingSource = readWorkspaceFile(
        `${CLOTHING_OPS_ROOT}/${relativeConfigPath}`
      );
      const gmSource = readWorkspaceFile(
        `${GM_OPS_ROOT}/${relativeConfigPath}`
      );

      const helperImport = '@/modules/shared/operations/moduleConfig';

      if (!clothingSource.includes(helperImport)) {
        failures.push(
          `${relativeConfigPath}: clothing does not import shared module config helper`
        );
      }

      if (!gmSource.includes(helperImport)) {
        failures.push(
          `${relativeConfigPath}: GM does not import shared module config helper`
        );
      }

      if (!clothingSource.includes('createOperationsModuleConfig(')) {
        failures.push(
          `${relativeConfigPath}: clothing does not use createOperationsModuleConfig()`
        );
      }

      if (!gmSource.includes('createOperationsModuleConfig(')) {
        failures.push(
          `${relativeConfigPath}: GM does not use createOperationsModuleConfig()`
        );
      }

      const moduleRootSegment = relativeConfigPath.split('/')[0];
      const expectedClothingPath = `/clothing/operations/${moduleRootSegment}`;
      const expectedGmPath = `/general-merchandise/operations/${moduleRootSegment}`;

      if (!clothingSource.includes(expectedClothingPath)) {
        failures.push(
          `${relativeConfigPath}: clothing module path does not include ${expectedClothingPath}`
        );
      }

      if (!gmSource.includes(expectedGmPath)) {
        failures.push(
          `${relativeConfigPath}: GM module path does not include ${expectedGmPath}`
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
