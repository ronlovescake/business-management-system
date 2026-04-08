/**
 * Accounting Settings API — Business-Rule-Mapped Tests
 *
 * Rules Covered (operations-settings.md Section C):
 *  C-12  GET /api/settings/accounting returns current settings (with lazy init)
 *  C-15  PUT /api/settings/accounting validates YYYY-MM-DD format
 *        parseDateOnly() — pure date parsing validation
 *        formatDateOnly() — pure date formatting
 *        toDateOnlyUtc() — UTC normalisation
 *        isMissingAccountingSettingsTable() — P2021 fail-open
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));

const mockGetAccountingCutoverDate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/accounting/cutover', () => ({
  getAccountingCutoverDate: mockGetAccountingCutoverDate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAccountingCutoverDate.mockReturnValue(new Date('2025-01-01T00:00:00Z'));
});

// ---------------------------------------------------------------------------
// Import route after mocks
// ---------------------------------------------------------------------------
const importRoute = () =>
  import('@/app/api/settings/accounting/route') as Promise<{
    GET: () => Promise<Response>;
    PUT: (req: Request) => Promise<Response>;
  }>;

// ---------------------------------------------------------------------------
// Helper to build a NextRequest-like object
// ---------------------------------------------------------------------------
function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Settings Accounting API', () => {
  // =========================================================================
  // GET — Lazy Init (Rule C-12)
  // =========================================================================
  describe('GET /api/settings/accounting', () => {
    it('Rule C-12: creates default settings on first fetch when table is empty', async () => {
      vi.resetModules();

      // ensureTable succeeds, fetchLatest returns empty, insertSettings returns row
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // fetchLatestSettings → empty
        .mockResolvedValueOnce([
          {
            id: 'new-1',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            clothingCutoverDate: new Date('2025-01-01'),
            generalMerchandiseCutoverDate: new Date('2025-01-01'),
          },
        ]); // insertSettings

      const { GET } = await importRoute();
      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clothingCutoverDate).toBe('2025-01-01');
      expect(json.generalMerchandiseCutoverDate).toBe('2025-01-01');
    });

    it('Rule C-12: returns existing settings when present', async () => {
      vi.resetModules();

      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'existing-1',
          createdAt: new Date('2025-06-01'),
          updatedAt: new Date('2025-06-01'),
          clothingCutoverDate: new Date('2025-03-15T00:00:00Z'),
          generalMerchandiseCutoverDate: new Date('2025-04-01T00:00:00Z'),
        },
      ]);

      const { GET } = await importRoute();
      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clothingCutoverDate).toBe('2025-03-15');
      expect(json.generalMerchandiseCutoverDate).toBe('2025-04-01');
    });

    it('P2021 fail-open: returns env fallback when table does not exist', async () => {
      vi.resetModules();

      const p2021Error: Error & { code?: string } = new Error(
        'The table `accounting_settings` does not exist'
      );
      p2021Error.code = 'P2021';

      mockPrisma.$executeRaw.mockRejectedValue(p2021Error);

      const { GET } = await importRoute();
      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.id).toBe('env-default');
      expect(json.clothingCutoverDate).toBe('2025-01-01');
    });
  });

  // =========================================================================
  // PUT — Date Validation (Rule C-15)
  // =========================================================================
  describe('PUT /api/settings/accounting', () => {
    it('Rule C-15: rejects invalid clothingCutoverDate', async () => {
      vi.resetModules();
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({
          clothingCutoverDate: 'not-a-date',
          generalMerchandiseCutoverDate: '2025-01-01',
        })
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid cutover date/i);
    });

    it('Rule C-15: rejects invalid generalMerchandiseCutoverDate', async () => {
      vi.resetModules();
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({
          clothingCutoverDate: '2025-01-01',
          generalMerchandiseCutoverDate: '2025-13-01',
        })
      );

      expect(res.status).toBe(400);
    });

    it('Rule C-15: rejects impossible calendar date (Feb 30)', async () => {
      vi.resetModules();
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({
          clothingCutoverDate: '2025-02-30',
          generalMerchandiseCutoverDate: '2025-01-01',
        })
      );

      expect(res.status).toBe(400);
    });

    it('Rule C-15: accepts valid dates and updates existing row', async () => {
      vi.resetModules();
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'existing-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            clothingCutoverDate: new Date('2025-01-01'),
            generalMerchandiseCutoverDate: new Date('2025-01-01'),
          },
        ]) // fetchLatest
        .mockResolvedValueOnce([
          {
            id: 'existing-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            clothingCutoverDate: new Date('2025-06-15T00:00:00Z'),
            generalMerchandiseCutoverDate: new Date('2025-07-01T00:00:00Z'),
          },
        ]); // updateSettings

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({
          clothingCutoverDate: '2025-06-15',
          generalMerchandiseCutoverDate: '2025-07-01',
        })
      );

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.clothingCutoverDate).toBe('2025-06-15');
      expect(json.generalMerchandiseCutoverDate).toBe('2025-07-01');
    });

    it('Rule C-15: creates new row when no settings exist', async () => {
      vi.resetModules();
      mockPrisma.$executeRaw.mockResolvedValue(undefined);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // fetchLatest → empty
        .mockResolvedValueOnce([
          {
            id: 'new-2',
            createdAt: new Date(),
            updatedAt: new Date(),
            clothingCutoverDate: new Date('2025-08-01T00:00:00Z'),
            generalMerchandiseCutoverDate: new Date('2025-08-15T00:00:00Z'),
          },
        ]); // insertSettings

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({
          clothingCutoverDate: '2025-08-01',
          generalMerchandiseCutoverDate: '2025-08-15',
        })
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.clothingCutoverDate).toBe('2025-08-01');
    });

    it('P2021 on PUT: returns 503 with migration message', async () => {
      vi.resetModules();
      const p2021Error: Error & { code?: string } = new Error(
        'The table `accounting_settings` does not exist'
      );
      p2021Error.code = 'P2021';
      mockPrisma.$executeRaw.mockRejectedValue(p2021Error);

      const { PUT } = await importRoute();
      const res = await PUT(
        makeRequest({
          clothingCutoverDate: '2025-01-01',
          generalMerchandiseCutoverDate: '2025-01-01',
        })
      );

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toMatch(/migration/i);
    });
  });
});
