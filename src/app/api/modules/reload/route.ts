/**
 * Module Reload API - HMR Endpoint
 *
 * POST /api/modules/reload
 *
 * Triggers hot module replacement for a specific module
 */

import { NextRequest, NextResponse } from 'next/server';
import { moduleHMR } from '@/core/ModuleHMR';
import type { HMROptions } from '@/core/ModuleHMR';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ReloadRequest {
  moduleId: string;
  options?: HMROptions;
}

interface ReloadResponse {
  success: boolean;
  moduleId: string;
  reloaded: boolean;
  duration: number;
  error?: string;
  message?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate reload request body
 */
function validateRequest(body: unknown): body is ReloadRequest {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const req = body as Partial<ReloadRequest>;

  // moduleId is required
  if (!req.moduleId || typeof req.moduleId !== 'string') {
    return false;
  }

  // options is optional but must be an object if provided
  if (req.options !== undefined && typeof req.options !== 'object') {
    return false;
  }

  return true;
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

/**
 * POST /api/modules/reload
 *
 * Reload a module with hot module replacement
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request
    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body: moduleId is required',
        } as ReloadResponse,
        { status: 400 }
      );
    }

    const { moduleId, options = {} } = body;

    console.log(`🔄 Reload request received for module: ${moduleId}`);

    // Trigger HMR reload
    const result = await moduleHMR.reloadModule(moduleId, options);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          moduleId: result.moduleId,
          reloaded: result.reloaded,
          duration: result.duration,
          message: `Module ${moduleId} reloaded successfully`,
        } as ReloadResponse,
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          moduleId: result.moduleId,
          reloaded: false,
          duration: result.duration,
          error: result.error || 'Reload failed',
        } as ReloadResponse,
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Module reload API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: `Reload failed: ${(error as Error).message}`,
      } as Partial<ReloadResponse>,
      { status: 500 }
    );
  }
}

/**
 * GET /api/modules/reload
 *
 * Get HMR statistics and pending reloads
 */
export async function GET(): Promise<NextResponse> {
  try {
    const stats = moduleHMR.getStatistics();
    const pendingReloads = moduleHMR.getPendingReloads();

    return NextResponse.json(
      {
        success: true,
        statistics: stats,
        pendingReloads,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('HMR statistics error:', error);

    return NextResponse.json(
      {
        success: false,
        error: `Failed to get statistics: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}
