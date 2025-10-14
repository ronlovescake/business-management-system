/**
 * Module Installation API Route
 *
 * POST /api/modules/install - Install a module from marketplace
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pluginManager } from '@/core/PluginManager';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { moduleId, version, force, skipDependencies } = await request.json();

    // Validate required fields
    if (!moduleId) {
      return NextResponse.json(
        { error: 'Missing required field: moduleId' },
        { status: 400 }
      );
    }

    // Initialize plugin manager if not already initialized
    await pluginManager.initialize();

    // Install module
    await pluginManager.installModule(moduleId, {
      version,
      force: force || false,
      skipDependencies: skipDependencies || false,
    });

    return NextResponse.json({
      success: true,
      message: `Module ${moduleId} installed successfully`,
    });
  } catch (error) {
    logger.error('Error installing module:', error);

    // Return appropriate error status
    const status =
      (error as { code?: string }).code === 'ALREADY_INSTALLED' ? 409 : 500;

    return NextResponse.json(
      {
        error: 'Failed to install module',
        details: (error as Error).message,
        code: (error as { code?: string }).code,
      },
      { status }
    );
  }
}
