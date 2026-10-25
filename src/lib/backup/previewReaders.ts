import fs from 'fs';
import type { Stream } from 'stream';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import Papa from 'papaparse';
import { BrowseError } from './dumpPreview';

export function readJsonRows(
  filePath: string,
  table: string,
  offset: number,
  limit: number,
  signal?: AbortSignal
) {
  return new Promise<unknown[]>((resolve, reject) => {
    const rows: unknown[] = [];
    let index = 0;
    let settled = false;
    const input = fs.createReadStream(filePath);
    const tokens = parser();
    const selection = pick({ filter: `tables.${table}.data` });
    const output = streamArray();
    const streams: (Stream & { destroy: () => void })[] = [
      input,
      tokens,
      selection,
      output,
    ];
    const timer = setTimeout(
      () => finish(new BrowseError('Table preview timed out', 504)),
      60000
    );
    const finish = (error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      streams.forEach((stream) => stream.destroy());
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    };
    const abort = () => finish(new BrowseError('Preview cancelled', 499));
    streams.forEach((stream) => stream.on('error', finish));
    output.on('data', (entry: { value: unknown }) => {
      if (index++ >= offset) {
        rows.push(entry.value);
      }
      if (rows.length >= limit) {
        finish();
      }
    });
    output.on('end', () => finish());
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
    } else {
      input.pipe(tokens).pipe(selection).pipe(output);
    }
  });
}

export function readCsvRows(
  filePath: string,
  offset: number,
  limit: number,
  signal?: AbortSignal
) {
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const rows: Record<string, unknown>[] = [];
    let index = 0;
    let settled = false;
    const input = fs.createReadStream(filePath, 'utf8');
    let csvParser: Papa.Parser | undefined;
    const timer = setTimeout(
      () => finish(new BrowseError('Table preview timed out', 504)),
      60000
    );
    const finish = (error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      input.destroy();
      csvParser?.abort();
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    };
    const abort = () => finish(new BrowseError('Preview cancelled', 499));
    input.on('error', finish);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    Papa.parse<Record<string, unknown>>(input, {
      header: true,
      skipEmptyLines: true,
      step(result, handle) {
        csvParser = handle;
        if (result.errors.length) {
          finish(new Error(result.errors[0].message));
          return;
        }
        if (index++ >= offset) {
          rows.push(result.data);
        }
        if (rows.length >= limit) {
          finish();
        }
      },
      complete: () => finish(),
      error: finish,
    });
  });
}
