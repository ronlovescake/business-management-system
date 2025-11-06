import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

/**
 * POST /api/users/profile/photo
 * Upload profile photo
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('photo') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'profiles');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const filename = `${user.id}-${timestamp}.${fileExtension}`;
    const filepath = join(uploadsDir, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Update user's photo URL in database
    const photoUrl = `/uploads/profiles/${filename}`;
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { photoUrl },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        photoUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: 'Profile photo uploaded successfully',
      user: updatedUser,
      photoUrl,
    });
  } catch (error) {
    logger.error('Error uploading profile photo:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/profile/photo
 * Remove profile photo
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update user's photo URL to null
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { photoUrl: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        photoUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: 'Profile photo removed successfully',
      user: updatedUser,
    });
  } catch (error) {
    logger.error('Error removing profile photo:', error);
    return NextResponse.json(
      { error: 'Failed to remove photo' },
      { status: 500 }
    );
  }
}
