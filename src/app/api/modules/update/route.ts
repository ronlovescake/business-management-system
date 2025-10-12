/**
 * Module Update API Route
 *
 * POST /api/modules/update - Update a module to latest version
 */

import { NextRequest, NextResponse } from 'next/server';
import { pluginManager } from '@/core/PluginManager';

export async function POST(request: NextRequest) {
  try {
    const { moduleId } = await request.json();

    // Validate required fields
    if (!moduleId) {
      return NextResponse.json(
        { error: 'Missing required field: moduleId' },
        { status: 400 }
      );
    }

    // Initialize plugin manager if not already initialized
    await pluginManager.initialize();

    // Update module
    await pluginManager.updateModule(moduleId);

    return NextResponse.json({
      success: true,
      message: `Module ${moduleId} updated successfully`,
    });
  } catch (error) {
    console.error('Error updating module:', error);

    // Return appropriate error status
    const status =
      (error as { code?: string }).code === 'NOT_INSTALLED' ? 404 : 500;

    return NextResponse.json(
      {
        error: 'Failed to update module',
        details: (error as Error).message,
        code: (error as { code?: string }).code,
      },
      { status }
    );
  }
}
