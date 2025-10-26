#!/usr/bin/env node

/**
 * Module Generator CLI
 *
 * Scaffolds a new module with perfect 10/10 structure
 *
 * Usage:
 *   npm run generate:module -- --name=leave-requests --workspace=employees
 *   npm run generate:module -- --name=inventory --workspace=operations
 *
 * Generates:
 * - Service layer with repository pattern
 * - API routes with validation
 * - Zod schemas
 * - Unit tests
 * - Integration tests
 * - TypeScript types
 * - Documentation
 */

const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const moduleName = args.name;
const workspace = args.workspace; // 'employees' or 'operations'

if (!moduleName || !workspace) {
  console.error('❌ Error: Missing required arguments');
  console.log('\nUsage:');
  console.log(
    '  npm run generate:module -- --name=<module-name> --workspace=<employees|operations>'
  );
  console.log('\nExample:');
  console.log(
    '  npm run generate:module -- --name=leave-requests --workspace=employees'
  );
  process.exit(1);
}

// Convert kebab-case to PascalCase
function toPascalCase(str) {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Convert kebab-case to camelCase
function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

const ModuleName = toPascalCase(moduleName);
const moduleCamel = toCamelCase(moduleName);

const basePath = path.join(
  __dirname,
  `../src/modules/clothing/${workspace}/${moduleName}`
);

console.log(`\n🚀 Generating module: ${ModuleName}`);
console.log(`📁 Location: ${basePath}\n`);

// Create directory structure
const dirs = [
  '',
  'api',
  'components',
  'hooks',
  'services',
  'types',
  'utils',
  '__tests__',
];

dirs.forEach((dir) => {
  const dirPath = path.join(basePath, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created: ${dir || '(root)'}`);
  }
});

// Templates
const templates = {
  // Types
  'types/index.ts': `/**
 * ${ModuleName} Types
 */

export interface ${ModuleName} {
  id: number;
  // Add your fields here
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Create${ModuleName}Input {
  // Add your input fields here
}

export interface Update${ModuleName}Input {
  // Add your input fields here
}

export interface ${ModuleName}QueryFilters {
  // Add your filter fields here
}
`,

  // Zod Schemas
  'api/schemas.ts': `/**
 * ${ModuleName} API Schemas
 */

import { z } from 'zod';

export const Create${ModuleName}Schema = z.object({
  // Add your validation rules here
  // Example:
  // name: z.string().min(1, 'Name is required'),
  // amount: z.number().positive('Amount must be positive'),
});

export const Update${ModuleName}Schema = Create${ModuleName}Schema.partial();

export const ${ModuleName}QuerySchema = z.object({
  // Add your query parameters here
  // Example:
  // status: z.enum(['active', 'inactive']).optional(),
  // startDate: z.string().datetime().optional(),
});

export type Create${ModuleName}Input = z.infer<typeof Create${ModuleName}Schema>;
export type Update${ModuleName}Input = z.infer<typeof Update${ModuleName}Schema>;
export type ${ModuleName}Query = z.infer<typeof ${ModuleName}QuerySchema>;
`,

  // Repository
  'services/repository.ts': `/**
 * ${ModuleName} Repository
 */

import { BaseRepository } from '@/core/database';
import { prisma } from '@/lib/prisma';
import type { ${ModuleName} } from '../types';

class ${ModuleName}Repository extends BaseRepository<${ModuleName}> {
  constructor() {
    super(prisma.${moduleCamel}, '${ModuleName}');
  }

  /**
   * Add custom repository methods here
   */
}

export const ${moduleCamel}Repository = new ${ModuleName}Repository();
`,

  // Service
  'services/index.ts': `/**
 * ${ModuleName} Service
 */

import { ${moduleCamel}Repository } from './repository';
import type { ${ModuleName}, Create${ModuleName}Input, Update${ModuleName}Input, ${ModuleName}QueryFilters } from '../types';
import { logger } from '@/lib/logger';

class ${ModuleName}Service {
  /**
   * Find all records
   */
  async findAll(): Promise<${ModuleName}[]> {
    return ${moduleCamel}Repository.findAll();
  }

  /**
   * Find records with filters
   */
  async findWithFilters(filters: ${ModuleName}QueryFilters): Promise<${ModuleName}[]> {
    return ${moduleCamel}Repository.findMany({ where: filters as any }).then(result => result.data);
  }

  /**
   * Find by ID
   */
  async findById(id: number): Promise<${ModuleName} | null> {
    return ${moduleCamel}Repository.findById(id);
  }

  /**
   * Create a new record
   */
  async create(data: Create${ModuleName}Input): Promise<${ModuleName}> {
    logger.info('${ModuleName}: Creating', { data });
    return ${moduleCamel}Repository.create(data as any);
  }

  /**
   * Update a record
   */
  async update(id: number, data: Update${ModuleName}Input): Promise<${ModuleName}> {
    logger.info('${ModuleName}: Updating', { id, data });
    return ${moduleCamel}Repository.update(id, data as any);
  }

  /**
   * Delete a record (soft delete)
   */
  async delete(id: number): Promise<void> {
    logger.info('${ModuleName}: Deleting', { id });
    await ${moduleCamel}Repository.delete(id);
  }
}

export const ${moduleCamel}Service = new ${ModuleName}Service();
`,

  // API Route
  'api/route.ts': `/**
 * ${ModuleName} API Route
 */

import type { NextRequest } from 'next/server';
import { withErrorHandler, withValidation, ApiResponseUtil } from '@/core/api';
import { ${moduleCamel}Service } from '../services';
import { Create${ModuleName}Schema, Update${ModuleName}Schema, ${ModuleName}QuerySchema } from './schemas';
import { logger } from '@/lib/logger';

/**
 * GET /api/${moduleName}
 * 
 * Fetch all records with optional filters
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  
  // Parse query params
  const queryParams = Object.fromEntries(searchParams.entries());
  
  if (Object.keys(queryParams).length > 0) {
    const filters = ${ModuleName}QuerySchema.parse(queryParams);
    const records = await ${moduleCamel}Service.findWithFilters(filters);
    return ApiResponseUtil.success(records);
  }

  const records = await ${moduleCamel}Service.findAll();
  return ApiResponseUtil.success(records);
});

/**
 * POST /api/${moduleName}
 * 
 * Create a new record
 */
export const POST = withValidation(
  Create${ModuleName}Schema,
  async (_request, validated) => {
    const record = await ${moduleCamel}Service.create(validated);
    return ApiResponseUtil.success(record, 'Record created successfully', 201);
  }
);

/**
 * PUT /api/${moduleName}
 * 
 * Update a record
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return ApiResponseUtil.badRequest('ID is required');
  }

  const validated = Update${ModuleName}Schema.parse(data);
  const record = await ${moduleCamel}Service.update(id, validated);
  
  return ApiResponseUtil.success(record, 'Record updated successfully');
});

/**
 * DELETE /api/${moduleName}
 * 
 * Delete a record (soft delete)
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponseUtil.badRequest('ID is required');
  }

  await ${moduleCamel}Service.delete(Number(id));
  
  return ApiResponseUtil.success(null, 'Record deleted successfully');
});
`,

  // Unit Tests
  '__tests__/service.test.ts': `/**
 * ${ModuleName} Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ${moduleCamel}Service } from '../services';
import { ${moduleCamel}Repository } from '../services/repository';

// Mock repository
vi.mock('../services/repository', () => ({
  ${moduleCamel}Repository: {
    findAll: vi.fn(),
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('${ModuleName}Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all records', async () => {
      const mockRecords = [
        { id: 1, createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
        { id: 2, createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
      ];

      vi.mocked(${moduleCamel}Repository.findAll).mockResolvedValue(mockRecords as any);

      const result = await ${moduleCamel}Service.findAll();

      expect(result).toEqual(mockRecords);
      expect(${moduleCamel}Repository.findAll).toHaveBeenCalledOnce();
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const mockInput = { /* add your fields */ };
      const mockRecord = {
        id: 1,
        ...mockInput,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      vi.mocked(${moduleCamel}Repository.create).mockResolvedValue(mockRecord as any);

      const result = await ${moduleCamel}Service.create(mockInput);

      expect(result).toEqual(mockRecord);
      expect(${moduleCamel}Repository.create).toHaveBeenCalledWith(mockInput);
    });
  });

  // Add more tests here
});
`,

  // Integration Tests
  '__tests__/api.integration.test.ts': `/**
 * ${ModuleName} API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('${ModuleName} API', () => {
  beforeAll(async () => {
    // Setup test data
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.$disconnect();
  });

  describe('GET /api/${moduleName}', () => {
    it('should return all records', async () => {
      const response = await fetch('http://localhost:3000/api/${moduleName}');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('POST /api/${moduleName}', () => {
    it('should create a new record', async () => {
      const payload = {
        // Add your test payload
      };

      const response = await fetch('http://localhost:3000/api/${moduleName}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
    });

    it('should reject invalid payload', async () => {
      const invalidPayload = {};

      const response = await fetch('http://localhost:3000/api/${moduleName}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.status).toBe(422);
    });
  });

  // Add more integration tests
});
`,

  // Module Index
  'index.ts': `/**
 * ${ModuleName} Module
 */

export * from './types';
export * from './services';
export { Create${ModuleName}Schema, Update${ModuleName}Schema, ${ModuleName}QuerySchema } from './api/schemas';
`,
};

// Write files
Object.entries(templates).forEach(([file, content]) => {
  const filePath = path.join(basePath, file);
  fs.writeFileSync(filePath, content);
  console.log(`📝 Generated: ${file}`);
});

console.log(`\n✨ Module ${ModuleName} generated successfully!`);
console.log(`\n📚 Next steps:`);
console.log(`  1. Update Prisma schema with ${ModuleName} model`);
console.log(`  2. Run: npx prisma generate`);
console.log(`  3. Update generated types in types/index.ts`);
console.log(`  4. Add validation rules in api/schemas.ts`);
console.log(`  5. Implement custom logic in services/index.ts`);
console.log(`  6. Run tests: npm run test ${moduleName}`);
console.log(`\n🎯 Module structure:`);
console.log(`  ├── api/           (API routes + Zod schemas)`);
console.log(`  ├── services/      (Business logic + Repository)`);
console.log(`  ├── types/         (TypeScript types)`);
console.log(`  ├── components/    (React components)`);
console.log(`  ├── hooks/         (Custom hooks)`);
console.log(`  ├── utils/         (Module utilities)`);
console.log(`  └── __tests__/     (Unit + Integration tests)`);
console.log('');
