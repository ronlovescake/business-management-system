/**
 * Marketplace Modules API Route
 *
 * GET /api/marketplace/modules - Fetch all published modules from marketplace
 *
 * Query parameters:
 * - search: string - Search query for filtering modules
 * - category: string - Filter by category/tag
 * - sort: 'downloads' | 'rating' | 'name' | 'date' - Sort order
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ModuleManifest, ModulePackage } from '@/core/ModuleRegistry';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const sort = searchParams.get('sort') || 'downloads';

    // Build where clause
    const where: {
      published: boolean;
      AND?: Array<{
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          description?: { contains: string; mode: 'insensitive' };
          keywords?: { has: string };
        }>;
      }>;
      keywords?: { has: string };
    } = {
      published: true,
    };

    // Add search filter
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { keywords: { has: search } },
          ],
        },
      ];
    }

    // Add category filter
    if (category) {
      where.keywords = { has: category };
    }

    // Build order by clause
    let orderBy: Record<string, 'asc' | 'desc'> = { downloads: 'desc' };

    switch (sort) {
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'date':
        orderBy = { publishedAt: 'desc' };
        break;
      default:
        orderBy = { downloads: 'desc' };
    }

    // Fetch modules from database
    const modules = await prisma.moduleMarketplace.findMany({
      where,
      orderBy,
      select: {
        id: true,
        moduleId: true,
        name: true,
        description: true,
        version: true,
        author: true,
        authorEmail: true,
        downloadUrl: true,
        repository: true,
        license: true,
        size: true,
        downloads: true,
        rating: true,
        screenshots: true,
        keywords: true,
        config: true,
        publishedAt: true,
      },
    });

    // Transform to ModulePackage format
    const modulePackages = modules.map((m): ModulePackage => {
      const config = m.config as unknown as ModulePackage;
      return {
        ...config,
        downloads: m.downloads,
        rating: m.rating ?? undefined,
        screenshots: m.screenshots,
      };
    });

    // Build manifest response
    const manifest: ModuleManifest = {
      modules: modulePackages,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };

    return NextResponse.json(manifest);
  } catch (error) {
    logger.error('Error fetching marketplace modules:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch marketplace modules',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
