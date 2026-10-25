import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeCopyValue,
  listDumpTables,
  parseCopyColumns,
  parseDumpTable,
  readDumpRows,
} from '@/lib/backup/dumpPreview';

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('child_process', () => ({
  spawn: mocks.spawn,
  default: { spawn: mocks.spawn },
}));

function processFixture(output?: string) {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  let closed = false;
  const close = (code: number | null) => {
    if (closed) {
      return;
    }
    closed = true;
    child.emit('close', code);
  };
  child.kill.mockImplementation(() => {
    queueMicrotask(() => close(null));
    return true;
  });
  mocks.spawn.mockImplementation(() => {
    if (output !== undefined) {
      queueMicrotask(() => {
        child.stdout.end(output);
        close(0);
      });
    }
    return child;
  });
  return child;
}
beforeEach(() => {
  vi.clearAllMocks();
});

describe('read-only dump preview parsing', () => {
  it('keeps schemas distinct and excludes non-table entries', () => {
    expect(
      parseDumpTable(
        '3400; 0 16401 TABLE DATA general_merchandise customers postgres'
      )?.key
    ).toBe('general_merchandise.customers');
    expect(
      parseDumpTable('3400; 0 16401 TABLE DATA public customers postgres')?.key
    ).toBe('public.customers');
    expect(
      parseDumpTable('3400; 0 16401 SEQUENCE SET public customers postgres')
    ).toBeNull();
  });
  it('reads quoted column names', () => {
    expect(
      parseCopyColumns(
        'COPY public.customers (id, "firstName", "quote""name") FROM stdin;'
      )
    ).toEqual(['id', 'firstName', 'quote"name']);
    expect(parseCopyColumns('SET statement_timeout = 0;')).toBeNull();
  });
  it('decodes COPY null, literal backslashes, controls and UTF-8 byte escapes', () => {
    expect(decodeCopyValue('\\N')).toBeNull();
    expect(decodeCopyValue('\\\\N')).toBe('\\N');
    expect(decodeCopyValue('First\\tSecond\\nThird')).toBe(
      'First\tSecond\nThird'
    );
    expect(decodeCopyValue('\\303\\251')).toBe('\u00e9');
    expect(decodeCopyValue('\\x41')).toBe('A');
  });
  it('extracts bounded rows without any database or shell arguments', async () => {
    const child = processFixture(
      'SET statement_timeout = 0;\nCOPY public.customers (id, name) FROM stdin;\n1\tFirst\n2\tSecond\n3\tThird\n\\.\n'
    );
    expect(
      await readDumpRows(
        'backup.dump',
        {
          key: 'public.customers',
          schema: 'public',
          name: 'customers',
          source: 'dump',
          count: null,
        },
        1,
        1
      )
    ).toEqual({ columns: ['id', 'name'], rows: [{ id: '2', name: 'Second' }] });
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    const args = mocks.spawn.mock.calls[0][1] as string[];
    expect(args).toContain('--file');
    expect(args).not.toContain('--dbname');
    expect(mocks.spawn.mock.calls[0][2].shell).toBeUndefined();
  });
  it('terminates the process when the request is cancelled', async () => {
    const child = processFixture();
    const controller = new AbortController();
    const pending = listDumpTables('backup.dump', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 499 });
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  });
  it('limits extraction concurrency and releases slots after abort', async () => {
    const first = new AbortController();
    processFixture();
    const one = listDumpTables('one.dump', first.signal);
    const second = new AbortController();
    processFixture();
    const two = listDumpTables('two.dump', second.signal);
    await expect(listDumpTables('third.dump')).rejects.toMatchObject({
      status: 503,
    });
    first.abort();
    second.abort();
    await Promise.allSettled([one, two]);
    processFixture('3400; 0 16401 TABLE DATA public customers postgres\n');
    expect(await listDumpTables('third.dump')).toHaveLength(1);
  });
});
