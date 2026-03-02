import fs from 'fs';
import path from 'path';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function walkFiles(dir: string, result: string[]) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolutePath, result);
      continue;
    }
    result.push(absolutePath);
  }
}

export function listRelativeFiles(baseDir: string, fileName: string): string[] {
  const absoluteBaseDir = path.join(process.cwd(), baseDir);
  const allFiles: string[] = [];
  walkFiles(absoluteBaseDir, allFiles);

  return allFiles
    .filter((filePath) => path.basename(filePath) === fileName)
    .map((filePath) =>
      path.relative(absoluteBaseDir, filePath).split(path.sep).join('/')
    )
    .sort();
}

export function listRelativeFilesBySuffix(
  baseDir: string,
  suffix: string
): string[] {
  const absoluteBaseDir = path.join(process.cwd(), baseDir);
  const allFiles: string[] = [];
  walkFiles(absoluteBaseDir, allFiles);

  return allFiles
    .map((filePath) =>
      path.relative(absoluteBaseDir, filePath).split(path.sep).join('/')
    )
    .filter((relativePath) => relativePath.endsWith(suffix))
    .sort();
}

export function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

export function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

export function getExportedHttpMethods(source: string): string[] {
  const constMatches =
    source.match(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g) ?? [];
  const functionMatches =
    source.match(
      /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g
    ) ?? [];
  const matches = [...constMatches, ...functionMatches];
  const methods = new Set<string>();
  for (const match of matches) {
    for (const method of HTTP_METHODS) {
      if (match.includes(method)) {
        methods.add(method);
      }
    }
  }
  return Array.from(methods).sort();
}

export function hasValidationMarker(source: string): boolean {
  return /(safeParse|\.parse\(|Schema\b|z\.object\()/m.test(source);
}

export function getErrorEnvelopeMarkers(source: string): string[] {
  const markers: Array<[string, RegExp]> = [
    ['withErrorHandler', /withErrorHandler/],
    ['ApiResponse', /\bApiResponse\b/],
    ['routeAdapterFactory', /create[A-Za-z0-9]+RouteHandler[s]?\s*\(/],
  ];

  return markers
    .filter(([, pattern]) => pattern.test(source))
    .map(([name]) => name)
    .sort();
}
