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
    const { moduleId } = params;

    const installedModule = await prisma.installedModule.findUnique({
      where: { moduleId },
    });

    if (!installedModule) {
      return NextResponse.json(
        { error: `Module ${moduleId} not found` },
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
    const { moduleId } = params;

    // Check if module exists
    const existingModule = await prisma.installedModule.findUnique({
      where: { moduleId },
    });

    if (!existingModule) {
      return NextResponse.json(
        { error: `Module ${moduleId} not found` },
        { status: 404 }
      );
    }

    // Delete module
    await prisma.installedModule.delete({
      where: { moduleId },
    });

    return NextResponse.json({
      success: true,
      message: `Module ${moduleId} removed successfully`,
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
