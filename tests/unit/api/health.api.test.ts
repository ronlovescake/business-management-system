import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockPrisma, mockGetDatabaseUrl } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $connect: vi.fn(),
      $queryRaw: vi.fn(),
    },
    mockGetDatabaseUrl: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual('@/lib/env');
  return {
    ...actual,
    getDatabaseUrl: mockGetDatabaseUrl,
  };
});

import { GET } from '@/app/api/health/route';

const originalEnv = process.env.DATABASE_URL;

describe('Health Check API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    // Default mock returns valid URL
    mockGetDatabaseUrl.mockReturnValue(
      'postgresql://user:pass@localhost:5432/testdb'
    );
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  describe('GET /api/health', () => {
    it('should return healthy status when database is connected', async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.database).toBe('connected');
      expect(data.services.api).toBe('operational');
      expect(data.services.database).toBe('operational');
    });

    it('should return degraded status when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      mockGetDatabaseUrl.mockImplementation(() => {
        throw new Error('DATABASE_URL is not set');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('degraded');
      expect(data.database).toBe('not-configured');
      expect(data.message).toContain('DATABASE_URL is not set');
    });

    it('should return degraded status for placeholder credentials', async () => {
      process.env.DATABASE_URL =
        'postgresql://username:password@localhost:5432/db';
      mockGetDatabaseUrl.mockReturnValue(
        'postgresql://username:password@localhost:5432/db'
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('degraded');
      expect(data.database).toBe('not-configured');
    });

    it('should return unhealthy status on connection error', async () => {
      mockPrisma.$connect.mockRejectedValue(
        new Error('Connection to database failed')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.database).toBe('error');
    });

    it('should return unhealthy status on authentication failure', async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockRejectedValue(
        new Error('Authentication failed for user')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.reason).toBe('authentication failed');
    });

    it('should include timestamp in response', async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(data.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
      );
    });
  });
});
