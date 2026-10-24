import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';

const database = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: database }));

describe('runtime accounting cutover isolation', () => {
  beforeEach(() => {
    database.$queryRaw.mockReset();
    vi.stubEnv('ACCOUNTING_CUTOVER_DATE', '2026-01-17');
    vi.stubEnv('ACCOUNTING_CUTOVER_DATE_CLOTHING', '2026-01-17');
    vi.stubEnv('ACCOUNTING_CUTOVER_DATE_GM', '2026-01-17');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('honors clothing settings when the optional GM column does not exist', async () => {
    database.$queryRaw.mockImplementation(
      async (query: TemplateStringsArray) => {
        if (query.join('').includes('generalMerchandiseCutoverDate')) {
          throw new Error('GM column does not exist');
        }
        return [{ cutoverDate: new Date('2026-02-03T14:00:00Z') }];
      }
    );
    expect(await getRuntimeAccountingCutoverDate('clothing')).toEqual(
      new Date('2026-02-03T00:00:00Z')
    );
  });

  it('still honors a configured GM cutover independently', async () => {
    database.$queryRaw.mockResolvedValue([
      { cutoverDate: new Date('2026-03-02T00:00:00Z') },
    ]);
    expect(await getRuntimeAccountingCutoverDate('generalMerchandise')).toEqual(
      new Date('2026-03-02T00:00:00Z')
    );
    expect(database.$queryRaw.mock.calls[0][0].join('')).toContain(
      'generalMerchandiseCutoverDate'
    );
  });

  it('falls back to the module environment when the settings table is missing', async () => {
    database.$queryRaw.mockRejectedValue(
      new Error('accounting_settings does not exist')
    );
    expect(await getRuntimeAccountingCutoverDate('clothing')).toEqual(
      new Date('2026-01-17T00:00:00Z')
    );
  });

  it('uses the fallback when there is no saved settings row', async () => {
    database.$queryRaw.mockResolvedValue([]);
    expect(await getRuntimeAccountingCutoverDate('clothing')).toEqual(
      new Date('2026-01-17T00:00:00Z')
    );
  });
});
