import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import path from 'path';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

const {
  mockRequireAdmin,
  mockGetDatabaseUrl,
  mockLogger,
  mockPrisma,
  mockSpawn,
  fsState,
} = vi.hoisted(() => {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  const mockSpawn = vi.fn();

  return {
    mockRequireAdmin: vi.fn().mockResolvedValue(undefined),
    mockGetDatabaseUrl: vi
      .fn()
      .mockReturnValue(
        'postgresql://test_user:test_pass@localhost:5432/test_db'
      ),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockPrisma: {
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(),
    },
    mockSpawn,
    fsState: {
      files,
      dirs,
    },
  };
});

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/env', () => ({
  getDatabaseUrl: mockGetDatabaseUrl,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

vi.mock('fs', () => {
  const ensureDir = (dirPath: string) => {
    const resolved = path.resolve(dirPath);
    fsState.dirs.add(resolved);
  };

  const ensureParentDirs = (filePath: string) => {
    let current = path.resolve(path.dirname(filePath));
    ensureDir(current);
    while (true) {
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      ensureDir(parent);
      current = parent;
    }
  };

  const existsSync = (target: string) => {
    const resolved = path.resolve(target);
    if (fsState.files.has(resolved)) {
      return true;
    }
    if (fsState.dirs.has(resolved)) {
      return true;
    }

    for (const filePath of Array.from(fsState.files.keys())) {
      if (filePath.startsWith(`${resolved}${path.sep}`)) {
        return true;
      }
    }

    return false;
  };

  const readFileSync = (filePath: string, encoding?: BufferEncoding) => {
    const resolved = path.resolve(filePath);
    const value = fsState.files.get(resolved);
    if (!value) {
      throw new Error(`ENOENT: ${resolved}`);
    }

    if (encoding) {
      return value.toString(encoding);
    }

    return Buffer.from(value);
  };

  const writeFileSync = (filePath: string, content: string | Buffer) => {
    const resolved = path.resolve(filePath);
    ensureParentDirs(resolved);
    fsState.files.set(
      resolved,
      Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content)
    );
  };

  const mkdirSync = (dirPath: string) => {
    ensureDir(dirPath);
  };

  const readdirSync = (
    dirPath: string,
    options?: { withFileTypes?: boolean }
  ) => {
    const resolved = path.resolve(dirPath);
    const childDirs = new Set<string>();
    const childFiles = new Set<string>();

    for (const existingDir of Array.from(fsState.dirs.values())) {
      if (!existingDir.startsWith(`${resolved}${path.sep}`)) {
        continue;
      }

      const relative = path.relative(resolved, existingDir);
      if (!relative || relative.startsWith('..')) {
        continue;
      }

      const [first] = relative.split(path.sep);
      if (first) {
        childDirs.add(first);
      }
    }

    for (const filePath of Array.from(fsState.files.keys())) {
      if (!filePath.startsWith(`${resolved}${path.sep}`)) {
        continue;
      }

      const relative = path.relative(resolved, filePath);
      if (!relative || relative.startsWith('..')) {
        continue;
      }

      const [first] = relative.split(path.sep);
      if (first) {
        if (relative.includes(path.sep)) {
          childDirs.add(first);
        } else {
          childFiles.add(first);
        }
      }
    }

    if (options?.withFileTypes) {
      return [
        ...Array.from(childDirs).map((name) => ({
          name,
          isDirectory: () => true,
          isFile: () => false,
        })),
        ...Array.from(childFiles).map((name) => ({
          name,
          isDirectory: () => false,
          isFile: () => true,
        })),
      ];
    }

    return [...Array.from(childDirs), ...Array.from(childFiles)];
  };

  const createReadStream = (filePath: string) => {
    const resolved = path.resolve(filePath);
    const value = fsState.files.get(resolved);
    if (!value) {
      throw new Error(`ENOENT: ${resolved}`);
    }

    return Readable.from(value);
  };

  const rmSync = (targetPath: string, options?: { recursive?: boolean }) => {
    const resolved = path.resolve(targetPath);

    if (options?.recursive) {
      for (const filePath of Array.from(fsState.files.keys())) {
        if (
          filePath === resolved ||
          filePath.startsWith(`${resolved}${path.sep}`)
        ) {
          fsState.files.delete(filePath);
        }
      }

      for (const dirPath of Array.from(fsState.dirs.values())) {
        if (
          dirPath === resolved ||
          dirPath.startsWith(`${resolved}${path.sep}`)
        ) {
          fsState.dirs.delete(dirPath);
        }
      }
      return;
    }

    fsState.files.delete(resolved);
    fsState.dirs.delete(resolved);
  };

  return {
    __esModule: true,
    default: {
      existsSync,
      readFileSync,
      writeFileSync,
      mkdirSync,
      readdirSync,
      createReadStream,
      rmSync,
    },
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    readdirSync,
    createReadStream,
    rmSync,
  };
});

vi.mock('fs/promises', () => {
  const writeFile = async (filePath: string, content: string | Buffer) => {
    const resolved = path.resolve(filePath);
    const parent = path.resolve(path.dirname(resolved));
    fsState.dirs.add(parent);
    fsState.files.set(
      resolved,
      Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content)
    );
  };

  const rename = async (oldPath: string, newPath: string) => {
    const oldResolved = path.resolve(oldPath);
    const newResolved = path.resolve(newPath);
    const value = fsState.files.get(oldResolved);
    if (!value) {
      throw new Error(`ENOENT: ${oldResolved}`);
    }
    fsState.files.set(newResolved, value);
    fsState.files.delete(oldResolved);
  };

  const stat = async (filePath: string) => {
    const resolved = path.resolve(filePath);
    const value = fsState.files.get(resolved);
    if (!value) {
      throw new Error(`ENOENT: ${resolved}`);
    }
    return { size: value.length };
  };

  return {
    __esModule: true,
    default: {
      writeFile,
      rename,
      stat,
    },
    writeFile,
    rename,
    stat,
  };
});

import { POST as createBackup } from '@/app/api/backup/route';
import { POST as restoreBackup } from '@/app/api/restore/route';

describe('Backup/Restore workflow hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fsState.files.clear();
    fsState.dirs.clear();
    fsState.dirs.add(path.resolve(process.cwd()));

    mockSpawn.mockImplementation((_command: string, args: string[]) => {
      const processEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();
      const fileFlagIndex = args.indexOf('-f');

      if (fileFlagIndex >= 0) {
        const dumpPath = path.resolve(args[fileFlagIndex + 1]);
        fsState.dirs.add(path.resolve(path.dirname(dumpPath)));
        fsState.files.set(dumpPath, Buffer.from('PGDMP'));
      }

      process.nextTick(() => {
        processEmitter.emit('close', 0);
      });

      return {
        stderr: {
          on: stderrEmitter.on.bind(stderrEmitter),
        },
        on: processEmitter.on.bind(processEmitter),
      };
    });

    const rows = [{ id: 1, name: 'Alice' }];

    const customerDelegate = {
      findFirst: vi.fn().mockImplementation(async () => rows[0] ?? null),
      findMany: vi
        .fn()
        .mockImplementation(async () => rows.map((row) => ({ ...row }))),
      count: vi.fn().mockImplementation(async () => rows.length),
      deleteMany: vi.fn().mockImplementation(async () => {
        const count = rows.length;
        rows.length = 0;
        return { count };
      }),
      createMany: vi
        .fn()
        .mockImplementation(async ({ data }: { data: typeof rows }) => {
          rows.length = 0;
          for (const record of data) {
            rows.push({ ...record });
          }
          return { count: data.length };
        }),
      update: vi.fn(),
      _rows: rows,
    };

    (mockPrisma as Record<string, unknown>).customer = customerDelegate;
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        return await callback({
          customer: customerDelegate,
        });
      }
    );
  });

  it('restores original customer snapshot after mutation', async () => {
    const backupResponse = await createBackup(
      new NextRequest('http://localhost/api/backup', {
        method: 'POST',
        body: JSON.stringify({
          format: 'json',
          strategy: 'full',
        }),
      })
    );

    const backupPayload = await backupResponse.json();
    expect(backupResponse.status).toBe(200);
    expect(backupPayload.success).toBe(true);

    const timestamp = backupPayload.backup.timestamp as string;
    const jsonFile = (backupPayload.backup.files as string[]).find((name) =>
      name.endsWith('.json')
    );
    expect(jsonFile).toBeTruthy();

    const customerDelegate = (mockPrisma as Record<string, unknown>)
      .customer as {
      _rows: Array<{ id: number; name: string }>;
    };

    customerDelegate._rows[0].name = 'Mutated Name';
    expect(customerDelegate._rows[0].name).toBe('Mutated Name');

    const restoreResponse = await restoreBackup(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp,
          file: jsonFile,
          tables: ['customers'],
          forceOverwrite: true,
          stopOnError: true,
        }),
      })
    );

    const restorePayload = await restoreResponse.json();

    expect(restoreResponse.status).toBe(200);
    expect(restorePayload.success).toBe(true);
    expect(restorePayload.results.customers.count).toBe(1);
    expect(customerDelegate._rows).toEqual([{ id: 1, name: 'Alice' }]);

    const manifestPath = path.resolve(
      process.cwd(),
      'backups',
      timestamp,
      'MANIFEST.json'
    );
    const manifestRaw = fsState.files.get(manifestPath);
    expect(manifestRaw).toBeTruthy();
    const manifest = JSON.parse(String(manifestRaw));
    expect(manifest.integrity.verified).toBe(true);
    expect(manifest.integrity.algorithm).toBe('sha256');
  });

  it('creates a PostgreSQL custom dump artifact when requested', async () => {
    const backupResponse = await createBackup(
      new NextRequest('http://localhost/api/backup', {
        method: 'POST',
        body: JSON.stringify({
          format: 'dump',
          strategy: 'full',
        }),
      })
    );

    const backupPayload = await backupResponse.json();

    expect(backupResponse.status).toBe(200);
    expect(backupPayload.success).toBe(true);
    expect(backupPayload.backup.files).toEqual([
      expect.stringMatching(/\.dump$/),
    ]);
    expect(mockSpawn).toHaveBeenCalled();

    const timestamp = backupPayload.backup.timestamp as string;
    const manifestPath = path.resolve(
      process.cwd(),
      'backups',
      timestamp,
      'MANIFEST.json'
    );
    const manifestRaw = fsState.files.get(manifestPath);
    expect(manifestRaw).toBeTruthy();

    const manifest = JSON.parse(String(manifestRaw));
    expect(manifest.format).toBe('dump');
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.stringMatching(/\.dump$/),
        }),
      ])
    );
  });
});
