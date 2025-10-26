/**
 * Module Configuration API Route (by ID)
 *
 * GET /api/modules/config/[moduleId] - Get specific module configuration
 * DELETE /api/modules/config/[moduleId] - Remove module configuration
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

interface RouteParams {
  params: {
    moduleId: string;
  };
}

/**
 * GET - Fetch specific module configuration
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const sanitizedModuleId = sanitizers.name(params.moduleId);

    const installedModule = await prisma.installedModule.findUnique({
      where: { moduleId: sanitizedModuleId },
    });

    if (!installedModule) {
      return NextResponse.json(
        { error: `Module ${sanitizedModuleId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(installedModule.config);
  } catch (error) {
    logger.error('Error fetching module configuration:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch module configuration',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove module configuration
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const sanitizedModuleId = sanitizers.name(params.moduleId);

    // Check if module exists
    const existingModule = await prisma.installedModule.findUnique({
      where: { moduleId: sanitizedModuleId },
    });

    if (!existingModule) {
      return NextResponse.json(
        { error: `Module ${sanitizedModuleId} not found` },
        { status: 404 }
      );
    }

    // Delete module
    await prisma.installedModule.delete({
      where: { moduleId: sanitizedModuleId },
    });

    return NextResponse.json({
      success: true,
      message: `Module ${sanitizedModuleId} removed successfully`,
    });
  } catch (error) {
    logger.error('Error removing module configuration:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove module configuration',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
