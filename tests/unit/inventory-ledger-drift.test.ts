import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  status: 'CREDIT_ISSUED',
  shortage: 100,
  extra: 0,
  info: vi.fn(),
  error: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: fixture.info, error: fixture.error },
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: vi.fn(async () => [
        {
          id: 42,
          productCode: 'CREDIT-SOURCE',
          quantity: 100,
          supplierFulfillmentStatus: fixture.status,
        },
      ]),
    },
    inventoryMovement: {
      findMany: vi.fn(async () => [
        {
          productCode: 'CREDIT-SOURCE',
          quantity: 100,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
        },
        {
          productCode: 'CREDIT-SOURCE',
          quantity: fixture.shortage,
          fromBucket: 'sellable',
          toBucket: 'supplier_short',
        },
        {
          productCode: 'CREDIT-SOURCE',
          quantity: fixture.extra,
          fromBucket: 'adjustment',
          toBucket: 'sellable',
        },
      ]),
    },
    $disconnect: fixture.disconnect,
  },
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

async function runReport() {
  await import('../../scripts/report-inventory-ledger-drift');
  await vi.waitFor(() => expect(fixture.disconnect).toHaveBeenCalledOnce());
}

describe('supplier-credit inventory ledger controls', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fixture.status = 'CREDIT_ISSUED';
    fixture.shortage = 100;
    fixture.extra = 0;
    process.exitCode = 0;
    process.argv = [
      process.execPath,
      'report-inventory-ledger-drift.ts',
      '--onlyWithMovements',
      '--minAbsDelta',
      '0.000001',
      '--failOnDrift',
    ];
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it('expects zero sellable stock for credited goods while preserving ordered quantity', async () => {
    await runReport();
    expect(fixture.info).toHaveBeenCalledWith(
      'Inventory ledger drift report',
      expect.objectContaining({ rows: 0 })
    );
    expect(fixture.error).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });

  it('still fails when an adjustment resurrects credited goods', async () => {
    fixture.extra = 5;
    await runReport();
    expect(fixture.info).toHaveBeenCalledWith(
      'Inventory ledger drift report',
      expect.objectContaining({ rows: 1 })
    );
    expect(process.exitCode).toBe(2);
  });

  it('preserves the existing quantity comparison for an active product', async () => {
    fixture.status = 'ACTIVE';
    fixture.shortage = 0;
    await runReport();
    expect(fixture.info).toHaveBeenCalledWith(
      'Inventory ledger drift report',
      expect.objectContaining({ rows: 0 })
    );
    expect(process.exitCode).toBe(0);
  });
});
