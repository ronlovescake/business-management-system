import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readCsvRows, readJsonRows } from '@/lib/backup/previewReaders';

const directories: string[] = [];
function fixture(name: string, content: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-preview-'));
  directories.push(directory);
  const filename = path.join(directory, name);
  fs.writeFileSync(filename, content);
  return filename;
}
afterEach(() =>
  directories
    .splice(0)
    .forEach((directory) =>
      fs.rmSync(directory, { recursive: true, force: true })
    )
);

describe('backup preview readers', () => {
  it('settles at the sample limit without waiting for the JSON chain to end', async () => {
    const filename = fixture(
      'backup.json',
      JSON.stringify({
        tables: {
          customers: {
            data: Array.from({ length: 2000 }, (_, index) => ({ id: index })),
          },
        },
      })
    );
    expect(await readJsonRows(filename, 'customers', 250, 250)).toEqual(
      Array.from({ length: 250 }, (_, index) => ({ id: index + 250 }))
    );
  }, 2000);

  it('reads an empty table and rejects malformed JSON', async () => {
    expect(
      await readJsonRows(
        fixture('empty.json', '{"tables":{"customers":{"data":[]}}}'),
        'customers',
        0,
        250
      )
    ).toEqual([]);
    await expect(
      readJsonRows(fixture('invalid.json', '{"tables":'), 'customers', 0, 250)
    ).rejects.toThrow();
  });

  it('streams CSV rows including quoted newlines', async () => {
    const filename = fixture(
      'table.csv',
      'id,name\n1,"First\nCustomer"\n2,Second\n3,Third\n'
    );
    expect(await readCsvRows(filename, 0, 1)).toEqual([
      { id: '1', name: 'First\nCustomer' },
    ]);
    expect(await readCsvRows(filename, 1, 1)).toEqual([
      { id: '2', name: 'Second' },
    ]);
  });

  it('rejects already-cancelled reads', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      readJsonRows(
        fixture('cancel.json', '{}'),
        'customers',
        0,
        1,
        controller.signal
      )
    ).rejects.toThrow('cancelled');
  });
});
