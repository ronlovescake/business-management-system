import { spawn } from 'child_process';
import { createInterface } from 'readline';

export class BrowseError extends Error {
  constructor(
    message: string,
    public status = 500
  ) {
    super(message);
  }
}

export type DumpTable = {
  key: string;
  schema: string;
  name: string;
  count: number | null;
  source: 'dump';
};

export function parseDumpTable(line: string): DumpTable | null {
  const match = line.match(
    /^\d+;\s+\d+\s+\d+\s+TABLE DATA\s+([a-zA-Z_][\w$]*)\s+([a-zA-Z_][\w$]*)\s/
  );
  if (!match) {
    return null;
  }
  const [, schema, name] = match;
  return {
    key: `${schema}.${name}`,
    schema,
    name,
    count: null,
    source: 'dump',
  };
}

export function decodeCopyValue(value: string): string | null {
  if (value === '\\N') {
    return null;
  }
  const escapes: Record<string, string> = {
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '\\': '\\',
  };
  const chunks: Buffer[] = [];
  let start = 0;
  const pattern = /\\([0-7]{1,3}|x[\da-fA-F]{1,2}|.)/g;
  for (const match of Array.from(value.matchAll(pattern))) {
    chunks.push(Buffer.from(value.slice(start, match.index)));
    const token = match[1];
    chunks.push(
      /^[0-7]/.test(token)
        ? Buffer.from([parseInt(token, 8)])
        : token.startsWith('x') && token.length > 1
          ? Buffer.from([parseInt(token.slice(1), 16)])
          : Buffer.from(escapes[token] ?? token)
    );
    start = (match.index ?? 0) + match[0].length;
  }
  chunks.push(Buffer.from(value.slice(start)));
  return Buffer.concat(chunks).toString('utf8');
}

export function parseCopyColumns(line: string): string[] | null {
  const match = line.match(/^COPY .+ \((.+)\) FROM stdin;$/);
  if (!match) {
    return null;
  }
  return (match[1].match(/"(?:[^"]|"")*"|[^,\s]+/g) ?? []).map((column) =>
    column.startsWith('"') ? column.slice(1, -1).replace(/""/g, '"') : column
  );
}

let active = 0;
function scanDump(
  filename: string,
  args: string[],
  onLine: (line: string) => boolean,
  signal?: AbortSignal
) {
  if (active >= 2) {
    throw new BrowseError('Backup browser is busy. Please retry shortly.', 503);
  }
  if (signal?.aborted) {
    throw new BrowseError('Preview cancelled', 499);
  }
  active++;
  return new Promise<void>((resolve, reject) => {
    const child = spawn('pg_restore', [...args, filename], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PGDATABASE: undefined, PGHOST: undefined },
    });
    const lines = createInterface({ input: child.stdout });
    let error: Error | undefined;
    let stopped = false;
    let stderr = '';
    let bytes = 0;
    const stop = () => {
      stopped = true;
      lines.close();
      child.kill('SIGKILL');
    };
    const abort = () => {
      error = new BrowseError('Preview cancelled', 499);
      stop();
    };
    const timeout = setTimeout(() => {
      error = new BrowseError(
        'Table preview timed out. Retry with a smaller page.',
        504
      );
      stop();
    }, 60000);
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.once('error', (failure) => {
      error = new BrowseError(
        failure.message.includes('ENOENT')
          ? 'PostgreSQL client is unavailable on this server.'
          : 'Unable to read this dump.',
        503
      );
    });
    lines.on('line', (line) => {
      if (stopped) {
        return;
      }
      bytes += Buffer.byteLength(line);
      if (bytes > 256 * 1024 * 1024) {
        error = new BrowseError(
          'Preview scan limit reached. Choose an earlier page.',
          413
        );
        stop();
        return;
      }
      try {
        if (onLine(line)) {
          stop();
        }
      } catch (failure) {
        error =
          failure instanceof Error ? failure : new Error('Invalid dump data');
        stop();
      }
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
    child.once('close', (code) => {
      active--;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      lines.close();
      if (error) {
        reject(error);
      } else if (!stopped && code !== 0) {
        reject(
          new BrowseError(
            stderr.includes('unsupported version')
              ? 'This dump needs a newer PostgreSQL client.'
              : 'Unable to read this dump. It may be damaged or incompatible.',
            422
          )
        );
      } else {
        resolve();
      }
    });
  });
}

export async function listDumpTables(filename: string, signal?: AbortSignal) {
  const tables: DumpTable[] = [];
  await scanDump(
    filename,
    ['--list'],
    (line) => {
      const table = parseDumpTable(line);
      if (table) {
        tables.push(table);
      }
      return false;
    },
    signal
  );
  return tables;
}

export async function readDumpRows(
  filename: string,
  table: DumpTable,
  offset: number,
  limit: number,
  signal?: AbortSignal
) {
  let columns: string[] = [];
  const rows: Record<string, unknown>[] = [];
  let inCopy = false;
  let index = 0;
  await scanDump(
    filename,
    [
      '--data-only',
      '--no-owner',
      '--no-privileges',
      '--schema',
      table.schema,
      '--table',
      table.name,
      '--file',
      '-',
    ],
    (line) => {
      if (!inCopy) {
        const header = parseCopyColumns(line);
        if (header) {
          columns = header;
          inCopy = true;
        }
        return false;
      }
      if (line === '\\.') {
        return true;
      }
      if (index++ >= offset) {
        const values = line.split('\t');
        if (values.length !== columns.length) {
          throw new BrowseError('Unsupported COPY data in this dump.', 422);
        }
        rows.push(
          Object.fromEntries(
            columns.map((column, index) => [
              column,
              decodeCopyValue(values[index]),
            ])
          )
        );
      }
      return rows.length >= limit;
    },
    signal
  );
  if (!columns.length) {
    throw new BrowseError('This table has no supported COPY data.', 422);
  }
  return { columns, rows };
}
