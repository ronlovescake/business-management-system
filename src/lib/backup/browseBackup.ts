import fs from 'fs';
import path from 'path';
import { getBackupDirectory } from '@/lib/backup-storage';
import { isValidTimestampFolderName } from '@/app/api/backup-restore/sharedRouteUtils';
import { BrowseError, listDumpTables, readDumpRows } from './dumpPreview';
import type { DumpTable } from './dumpPreview';
import { readCsvRows, readJsonRows } from './previewReaders';

export type BrowseTable = Omit<DumpTable, 'source'> & {
  source: 'json' | 'csv' | 'dump';
};
type Artifacts = {
  folder: string;
  json?: string;
  dump?: string;
  counts: Record<string, number>;
  strategy: string;
  files: string[];
};
const catalogs = new Map<string, DumpTable[]>();

export function isBackupArtifact(filename: string) {
  return (
    !filename.endsWith('.summary.json') &&
    filename !== 'MANIFEST.json' &&
    /\.(json|csv|xlsx|dump|sql)$/.test(filename)
  );
}

function containedFile(folder: string, filename: string) {
  const resolved = fs.realpathSync(path.join(folder, filename));
  if (!resolved.startsWith(`${folder}${path.sep}`)) {
    throw new BrowseError('Access denied', 403);
  }
  return resolved;
}

export function resolveBrowseArtifacts(timestamp: string): Artifacts {
  if (!isValidTimestampFolderName(timestamp)) {
    throw new BrowseError('Invalid backup timestamp', 400);
  }
  const root = fs.realpathSync(getBackupDirectory());
  const candidate = path.join(root, timestamp);
  if (!fs.existsSync(candidate)) {
    throw new BrowseError('Backup not found', 404);
  }
  const folder = fs.realpathSync(candidate);
  if (!folder.startsWith(`${root}${path.sep}`)) {
    throw new BrowseError('Access denied', 403);
  }
  const files = fs.readdirSync(folder).filter(isBackupArtifact);
  const jsonName = files.find((file) =>
    /^(full|differential|log)-backup-.+\.json$/.test(file)
  );
  const dumpName = files.find((file) => file.endsWith('.dump'));
  const manifestPath = path.join(folder, 'MANIFEST.json');
  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(
        fs.readFileSync(containedFile(folder, 'MANIFEST.json'), 'utf8')
      ) as { recordCounts?: Record<string, number>; strategy?: string })
    : null;
  let counts = manifest?.recordCounts ?? {};
  if (
    !Object.keys(counts).length &&
    jsonName &&
    fs.existsSync(path.join(folder, `${jsonName}.summary.json`))
  ) {
    const summary = JSON.parse(
      fs.readFileSync(containedFile(folder, `${jsonName}.summary.json`), 'utf8')
    ) as { tables?: Record<string, { count: number }> };
    counts = Object.fromEntries(
      Object.entries(summary.tables ?? {}).map(([key, value]) => [
        key,
        value.count,
      ])
    );
  }
  return {
    folder,
    files,
    counts,
    strategy: manifest?.strategy ?? 'full',
    json: jsonName ? containedFile(folder, jsonName) : undefined,
    dump: dumpName ? containedFile(folder, dumpName) : undefined,
  };
}

export async function getBrowseCatalog(
  timestamp: string,
  signal?: AbortSignal
) {
  const artifacts = resolveBrowseArtifacts(timestamp);
  let tables: BrowseTable[] = [];
  if (artifacts.json && Object.keys(artifacts.counts).length) {
    tables = Object.entries(artifacts.counts)
      .filter(([key]) => /^[\w]+$/.test(key))
      .map(([key, count]) => ({
        key,
        schema: key.startsWith('general_merchandise_')
          ? 'general_merchandise'
          : 'public',
        name: key,
        count,
        source: 'json',
      }));
  } else if (artifacts.dump) {
    const stat = fs.statSync(artifacts.dump);
    const cacheKey = `${artifacts.dump}:${stat.size}:${stat.mtimeMs}`;
    let cached = catalogs.get(cacheKey);
    if (!cached) {
      cached = await listDumpTables(artifacts.dump, signal);
      if (catalogs.size >= 16) {
        catalogs.delete(catalogs.keys().next().value as string);
      }
      catalogs.set(cacheKey, cached);
    }
    tables = cached;
  } else {
    tables = artifacts.files
      .filter((file) => file.endsWith(`-${timestamp}.csv`))
      .map((file) => {
        const key = file.slice(0, -`-${timestamp}.csv`.length);
        return {
          key,
          schema: key.startsWith('general_merchandise_')
            ? 'general_merchandise'
            : 'public',
          name: key,
          count: artifacts.counts[key] ?? null,
          source: 'csv',
        };
      });
  }
  if (!tables.length) {
    throw new BrowseError(
      'This backup has no browsable table exports or supported dump tables.',
      409
    );
  }
  return {
    strategy: artifacts.strategy,
    tables: [...tables].sort((left, right) =>
      left.key.localeCompare(right.key)
    ),
  };
}

export async function getBrowseRows(
  timestamp: string,
  key: string,
  offset: number,
  limit: number,
  signal?: AbortSignal
) {
  const { tables } = await getBrowseCatalog(timestamp, signal);
  const table = tables.find((entry) => entry.key === key);
  if (!table) {
    throw new BrowseError('Table not found in this backup', 404);
  }
  const artifacts = resolveBrowseArtifacts(timestamp);
  let columns: string[];
  let rows: Record<string, unknown>[];
  if (table.source === 'dump' && artifacts.dump) {
    const sample = await readDumpRows(
      artifacts.dump,
      { ...table, source: 'dump' },
      offset,
      limit + 1,
      signal
    );
    ({ columns, rows } = sample);
  } else {
    const csv = `${table.key}-${timestamp}.csv`;
    if (table.source === 'csv' || artifacts.files.includes(csv)) {
      rows = await readCsvRows(
        containedFile(artifacts.folder, csv),
        offset,
        limit + 1,
        signal
      );
    } else if (artifacts.json) {
      rows = (await readJsonRows(
        artifacts.json,
        table.key,
        offset,
        limit + 1,
        signal
      )) as Record<string, unknown>[];
    } else {
      throw new BrowseError('Table export unavailable', 409);
    }
    columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  }
  return {
    columns,
    rows: rows.slice(0, limit),
    offset,
    limit,
    total: table.count,
    hasMore: rows.length > limit,
    source: table.source,
  };
}
