import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import {
  findValidPasswordResetToken,
  markPasswordResetTokenConsumed,
  revokeOtherActiveResetTokens,
} from '@/lib/auth/password-reset';

const resetSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid token or password.' },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    const record = await findValidPasswordResetToken(token);

    if (!record) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired.' },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 12);

    await prisma.user.update({
      where: { id: record.userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    await markPasswordResetTokenConsumed(record.id);

    await revokeOtherActiveResetTokens({
      userId: record.userId,
      excludeTokenId: record.id,
    });

    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch (error) {
    logger.error('Failed to reset password', error);
    return NextResponse.json(
      { error: 'Unable to reset password at this time.' },
      { status: 500 }
    );
  }
}
