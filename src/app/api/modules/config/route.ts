/**
 * Module Configuration API Routes
 *
 * GET /api/modules/config - Get all installed modules
 * POST /api/modules/config - Save a module configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ModulePackage } from '@/core/ModuleRegistry';
import type { Prisma } from '@prisma/client';

/**
 * GET - Fetch all installed modules
 */
export async function GET() {
  try {
    const installedModules = await prisma.installedModule.findMany({
      orderBy: { installedAt: 'desc' },
    });

    // Transform to ModulePackage format
    const modules: ModulePackage[] = installedModules.map(
      (m): ModulePackage => {
        const config = m.config as unknown as ModulePackage;
        return {
          ...config,
          enabled: m.enabled,
        };
      }
    );

    return NextResponse.json(modules);
  } catch (error) {
    logger.error('Error fetching installed modules:', error);

    // Return empty array if table doesn't exist yet
    if ((error as { code?: string }).code === 'P2021') {
      return NextResponse.json([]);
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch installed modules',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Save a module configuration
 */
export async function POST(request: NextRequest) {
  try {
    const modulePackage: ModulePackage = await request.json();

    // Validate required fields
    if (!modulePackage.id || !modulePackage.name || !modulePackage.version) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, version' },
        { status: 400 }
      );
    }

    // Upsert module configuration
    const savedModule = await prisma.installedModule.upsert({
      where: { moduleId: modulePackage.id },
      create: {
        moduleId: modulePackage.id,
        name: modulePackage.name,
        version: modulePackage.version,
        enabled: modulePackage.enabled,
        source: modulePackage.source || 'local',
        installPath: modulePackage.installPath || null,
        config: modulePackage as unknown as Prisma.InputJsonValue,
        installedBy: null, // TODO: Add user authentication
      },
      update: {
        name: modulePackage.name,
        version: modulePackage.version,
        enabled: modulePackage.enabled,
        config: modulePackage as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      module: savedModule,
    });
  } catch (error) {
    logger.error('Error saving module configuration:', error);
    return NextResponse.json(
      {
        error: 'Failed to save module configuration',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
