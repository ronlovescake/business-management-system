#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [rawKey, rawValue] = arg.replace(/^--/, '').split('=');
  if (!rawKey) {
    return acc;
  }
  acc[rawKey] = rawValue ?? 'true';
  return acc;
}, {});

const moduleName = args.name;
const domain = args.domain;
const section = args.section;
const tableEngine = args.table || 'custom';
const withPage = args.withPage === 'true';

const ALLOWED_DOMAINS = [
  'clothing',
  'general-merchandise',
  'trucking',
  'household',
  'shared',
];

if (!moduleName || !domain) {
  console.error('❌ Missing required arguments.');
  console.log('Usage:');
  console.log(
    '  npm run generate:module -- --name=<module-name> --domain=<clothing|general-merchandise|trucking|household|shared> [--section=<section>] [--table=<handsontable|mantine|custom>] [--withPage=true]'
  );
  process.exit(1);
}

if (!ALLOWED_DOMAINS.includes(domain)) {
  console.error(`❌ Unsupported domain: ${domain}`);
  console.error(`Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  process.exit(1);
}

function toPascalCase(input) {
  return input
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(input) {
  const pascal = toPascalCase(input);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(`⚠️ Skipped existing file: ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Created: ${filePath}`);
}

const modulePascal = toPascalCase(moduleName);
const moduleCamel = toCamelCase(moduleName);

const moduleBasePath = section
  ? path.join(process.cwd(), 'src', 'modules', domain, section, moduleName)
  : path.join(process.cwd(), 'src', 'modules', domain, moduleName);

const componentName = `${modulePascal}Page`;
const hookName = `use${modulePascal}`;
const serviceName = `${modulePascal}Service`;

const directories = [
  moduleBasePath,
  path.join(moduleBasePath, 'api'),
  path.join(moduleBasePath, 'components'),
  path.join(moduleBasePath, 'hooks'),
  path.join(moduleBasePath, 'services'),
  path.join(moduleBasePath, 'types'),
  path.join(moduleBasePath, 'utils'),
  path.join(moduleBasePath, '__tests__'),
];

directories.forEach(ensureDir);

const entityType = `${modulePascal}Entity`;
const createInputType = `Create${modulePascal}Input`;
const updateInputType = `Update${modulePascal}Input`;
const filtersType = `${modulePascal}Filters`;

writeFileIfMissing(
  path.join(moduleBasePath, 'types', 'index.ts'),
  `export interface ${entityType} {
  id: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ${createInputType} {
  name: string;
}

export interface ${updateInputType} extends Partial<${createInputType}> {}

export interface ${filtersType} {
  query?: string;
}
`
);

writeFileIfMissing(
  path.join(moduleBasePath, 'api', 'schemas.ts'),
  `import { z } from 'zod';

export const create${modulePascal}Schema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const update${modulePascal}Schema = create${modulePascal}Schema.partial();

export const ${moduleCamel}FiltersSchema = z.object({
  query: z.string().optional(),
});
`
);

writeFileIfMissing(
  path.join(moduleBasePath, 'services', 'index.ts'),
  `import type {
  ${entityType},
  ${createInputType},
  ${updateInputType},
  ${filtersType},
} from '../types';

class ${serviceName} {
  async list(_filters?: ${filtersType}): Promise<${entityType}[]> {
    return [];
  }

  async create(input: ${createInputType}): Promise<${entityType}> {
    return {
      id: Date.now(),
      name: input.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    } as ${entityType};
  }

  async update(id: number, input: ${updateInputType}): Promise<${entityType}> {
    return {
      id,
      name: input.name ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    } as ${entityType};
  }
}

export const ${moduleCamel}Service = new ${serviceName}();
`
);

writeFileIfMissing(
  path.join(moduleBasePath, 'hooks', `${hookName}.ts`),
  `import { useMemo } from 'react';
import type { ${entityType} } from '../types';

export function ${hookName}(rows: ${entityType}[]) {
  const totalCount = useMemo(() => rows.length, [rows]);

  return {
    rows,
    totalCount,
  };
}
`
);

writeFileIfMissing(
  path.join(moduleBasePath, 'components', `${componentName}.tsx`),
  `'use client';

import { Paper, Text } from '@mantine/core';

export function ${componentName}() {
  return (
    <Paper p="md" withBorder>
      <Text fw={600}>${modulePascal}</Text>
      <Text size="sm" c="dimmed">
        Table engine: ${tableEngine}. Keep business logic in services/hooks and keep this component presentational.
      </Text>
    </Paper>
  );
}
`
);

writeFileIfMissing(
  path.join(moduleBasePath, 'api', 'route.ts'),
  `import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  paginatedResponse,
  paginationFor,
} from '@/lib/api/pagination';
import { create${modulePascal}Schema } from './schemas';
import { ${moduleCamel}Service } from '../services';

export async function GET(request: NextRequest) {
  const { take, skip, limit } = paginationFor(request);
  const rows = await ${moduleCamel}Service.list();
  // TODO: push limit/offset into the service so the DB does the slicing.
  const slice = rows.slice(skip, skip + take);
  return NextResponse.json(
    paginatedResponse(slice, { total: rows.length, limit, offset: skip })
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = create${modulePascal}Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        validationErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  const created = await ${moduleCamel}Service.create(parsed.data);
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
`
);

writeFileIfMissing(
  path.join(moduleBasePath, '__tests__', `${moduleCamel}.service.test.ts`),
  `import { describe, it, expect } from 'vitest';
import { ${moduleCamel}Service } from '../services';

describe('${serviceName}', () => {
  it('returns empty list by default', async () => {
    const rows = await ${moduleCamel}Service.list();
    expect(rows).toEqual([]);
  });
});
`
);

writeFileIfMissing(
  path.join(moduleBasePath, 'index.ts'),
  `export * from './types';
export * from './services';
export * from './hooks/${hookName}';
export * from './components/${componentName}';
`
);

if (withPage) {
  const appPathParts = ['src', 'app', domain];
  if (section) {
    appPathParts.push(section);
  }
  appPathParts.push(moduleName);

  const appPageDir = path.join(process.cwd(), ...appPathParts);
  ensureDir(appPageDir);

  writeFileIfMissing(
    path.join(appPageDir, 'page.tsx'),
    `import { ${componentName} } from '@/modules/${domain}${section ? `/${section}` : ''}/${moduleName}/components/${componentName}';

export default function Page() {
  return <${componentName} />;
}
`
  );
}

console.log('\n✨ Module scaffold complete.');
console.log(`Domain: ${domain}`);
console.log(`Section: ${section || '(none)'}`);
console.log(`Table engine: ${tableEngine}`);
console.log(`Path: ${moduleBasePath}`);
