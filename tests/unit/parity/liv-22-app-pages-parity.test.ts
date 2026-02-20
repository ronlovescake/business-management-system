import { describe, expect, it } from 'vitest';
import {
  intersection,
  listRelativeFiles,
  readWorkspaceFile,
} from './parityTestUtils';

const CLOTHING_APP_ROOT = 'src/app/clothing';
const GM_APP_ROOT = 'src/app/general-merchandise';

describe('LIV-22 app pages parity (clothing vs GM)', () => {
  const clothingPages = listRelativeFiles(CLOTHING_APP_ROOT, 'page.tsx');
  const gmPages = listRelativeFiles(GM_APP_ROOT, 'page.tsx');
  const sharedPages = intersection(clothingPages, gmPages);

  it('keeps a broad set of shared page paths for parity coverage', () => {
    expect(sharedPages.length).toBeGreaterThanOrEqual(30);
  });

  it('keeps GM shared pages wired to shared/clothing behavior surfaces', () => {
    const failures: string[] = [];

    for (const relativePagePath of sharedPages) {
      const gmSource = readWorkspaceFile(`${GM_APP_ROOT}/${relativePagePath}`);

      const hasSharedBehaviorWiring =
        gmSource.includes('@/app/clothing/') ||
        gmSource.includes('/_shared/') ||
        gmSource.includes('renderGmOperationsPage(') ||
        gmSource.includes('renderGmEmployeesPage(');

      if (!hasSharedBehaviorWiring) {
        failures.push(
          `${relativePagePath}: GM page is not wired through shared/clothing behavior abstractions`
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
