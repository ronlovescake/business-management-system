import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '@/app/clothing/operations/handbook/page';
import { getRequiredRolesForPath } from '@/core/routePermissions';
import { buildNavigationItems } from '@/components/navigation/navigationItems';
import { HANDBOOK_PATH } from '../handbook';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadHandbook: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('../loadHandbook.server', () => ({ loadHandbook: mocks.loadHandbook }));
vi.mock('../HandbookPage', () => ({ HandbookPage: () => null }));
vi.mock('@/modules', () => ({ moduleRegistry: { getNavigation: () => [] } }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error('notFound');
  },
}));

describe('Clothing handbook route and navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
    vi.clearAllMocks();
    mocks.loadHandbook.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['USER', 'ADMIN', 'SUPER_ADMIN'])(
    'allows authenticated %s without module grants',
    async (role) => {
      mocks.getCurrentUser.mockResolvedValue({ id: 'employee', role });
      expect(await Page()).toMatchObject({ props: { procedures: [] } });
      expect(mocks.loadHandbook).toHaveBeenCalledOnce();
      expect(getRequiredRolesForPath(HANDBOOK_PATH)).toContain(role);
    }
  );

  it('rejects anonymous users before loading employee content', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(Page()).rejects.toThrow('redirect:/login');
    expect(mocks.loadHandbook).not.toHaveBeenCalled();
  });

  it('rejects unsupported roles even if middleware is bypassed', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'unsupported',
      role: 'OTHER',
    });
    await expect(Page()).rejects.toThrow('notFound');
    expect(mocks.loadHandbook).not.toHaveBeenCalled();
  });

  it('does not broaden accounting, HR, supplier or inventory-posting permissions', () => {
    for (const path of [
      '/clothing/accounting/ledger',
      '/clothing/employees/payroll',
      '/api/accounting/manual-journal',
      '/api/expenses',
      '/api/products/supplier-credits',
      '/api/products/1/supplier-resolution',
      '/api/shipments/1/transit-build',
    ]) {
      expect(getRequiredRolesForPath(path)).toEqual(['ADMIN', 'SUPER_ADMIN']);
    }
  });

  it('adds exactly one Clothing Operations item and excludes other businesses and workspaces', () => {
    const items = buildNavigationItems('clothing', 'operations');
    expect(items.filter((item) => item.path === HANDBOOK_PATH)).toHaveLength(1);
    expect(items.find((item) => item.path === HANDBOOK_PATH)?.label).toBe(
      'Employee Handbook'
    );
    for (const business of [
      'clothing',
      'general-merchandise',
      'trucking',
      'personal',
    ] as const) {
      for (const workspace of [
        'operations',
        'employees',
        'accounting',
        'expenses',
        'personal',
      ] as const) {
        if (business === 'clothing' && workspace === 'operations') {
          continue;
        }
        expect(
          buildNavigationItems(business, workspace).some((item) =>
            item.path.endsWith('/handbook')
          )
        ).toBe(false);
      }
    }
  });
});
