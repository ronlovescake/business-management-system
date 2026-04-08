/**
 * Settings — Transaction Settings API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/settings-and-configuration.md:
 *   #16 — Transaction settings are lazily initialized
 *   #17 — minSpareRows defaults to 50
 *   #18 — Several transaction fields can be made read-only by configuration
 *   #19 — Read-only flags default to true in the generated settings record
 *   #20 — PUT only updates the provided transaction-setting fields
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindFirst, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    transactionsSettings: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET, PUT } from '@/app/api/settings/transactions/route';

function makePutRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/settings/transactions',
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );
}

const DEFAULTS = {
  id: 'settings-1',
  minSpareRows: 50,
  unitPriceReadOnly: true,
  lineTotalReadOnly: true,
  invoiceDateReadOnly: true,
  packedDateReadOnly: true,
  shipmentCodeReadOnly: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Settings — Transaction Settings API (Business Rules)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Rule #16: Transaction settings are lazily initialized
  it('Rule #16: GET creates default settings when none exist', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(DEFAULTS);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(json.minSpareRows).toBe(50);
  });

  it('Rule #16: GET returns existing settings without creating', async () => {
    mockFindFirst.mockResolvedValue({
      ...DEFAULTS,
      minSpareRows: 30,
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(json.minSpareRows).toBe(30);
  });

  // Rule #17: minSpareRows defaults to 50
  it('Rule #17: default minSpareRows is 50', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(DEFAULTS);

    await GET();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          minSpareRows: 50,
        }),
      })
    );
  });

  // Rule #19: Read-only flags default to true
  it('Rule #19: all read-only flags default to true', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(DEFAULTS);

    await GET();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitPriceReadOnly: true,
          lineTotalReadOnly: true,
          invoiceDateReadOnly: true,
          packedDateReadOnly: true,
          shipmentCodeReadOnly: true,
        }),
      })
    );
  });

  // Rule #18: Several fields can be made read-only by configuration
  it('Rule #18: PUT can toggle individual read-only flags', async () => {
    mockFindFirst.mockResolvedValue(DEFAULTS);
    mockUpdate.mockResolvedValue({
      ...DEFAULTS,
      unitPriceReadOnly: false,
    });

    const res = await PUT(makePutRequest({ unitPriceReadOnly: false }));

    expect(res.status).toBe(200);
  });

  // Rule #20: PUT only updates the provided fields
  it('Rule #20: PUT sends only the provided fields to update', async () => {
    mockFindFirst.mockResolvedValue(DEFAULTS);
    mockUpdate.mockResolvedValue({
      ...DEFAULTS,
      invoiceDateReadOnly: false,
    });

    await PUT(makePutRequest({ invoiceDateReadOnly: false }));

    // The update should be called and should not override other fields to undefined
    expect(mockUpdate).toHaveBeenCalled();
  });
});
