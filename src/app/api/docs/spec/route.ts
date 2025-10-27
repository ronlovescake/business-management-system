/**
 * OpenAPI Specification Endpoint
 * 
 * Serves the complete OpenAPI 3.0 specification as JSON.
 * Used by Swagger UI to render the interactive documentation.
 * 
 * GET /api/docs/spec - Returns OpenAPI specification
 */

import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi/spec';

export const dynamic = 'force-static';

/**
 * GET /api/docs/spec
 * 
 * Returns the complete OpenAPI 3.0 specification for all API endpoints
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
