import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Readable } from 'stream';

const {
  mockRequireAdmin,
  mockExistsSync,
  mockReadFileSync,
  mockCreateReadStream,
  mockCreateHash,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn().mockResolvedValue(undefined),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockCreateReadStream: vi.fn(),
  mockCreateHash: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('crypto', () => ({
  default: {
    createHash: mockCreateHash,
  },
  createHash: mockCreateHash,
}));

vi.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    createReadStream: mockCreateReadStream,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  createReadStream: mockCreateReadStream,
}));

import { POST as restorePost } from '@/app/api/restore/route';

describe('Backup/Restore integrity hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateHash.mockReturnValue({
      update: vi.fn(),
      digest: vi.fn().mockReturnValue('actual-checksum'),
    });

    mockCreateReadStream.mockImplementation(() => {
      return Readable.from(['file-bytes']);
    });

    mockExistsSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith('MANIFEST.json')) {
        return true;
      }
      if (filePath.endsWith('.json')) {
        return true;
      }
      return false;
    });

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith('MANIFEST.json')) {
        return JSON.stringify({
          files: [
            {
              name: 'backup-2026-02-11T10-10-10.json',
              checksum: 'expected-checksum',
            },
          ],
        });
      }

      return JSON.stringify({
        tables: {
          transactions: {
            data: [{ id: 1, customer: 'Alice' }],
          },
        },
      });
    });
  });

  it('rejects restore when backup checksum does not match manifest', async () => {
    const response = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['transactions'],
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('integrity verification failed');
  });
});
