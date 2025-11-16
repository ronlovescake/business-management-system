import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/db';

export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 30;
export const PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES = 2;

function hashToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function generatePasswordResetToken(params: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
  );

  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: params.userId,
      OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }],
    },
  });

  const token = await prisma.passwordResetToken.create({
    data: {
      userId: params.userId,
      tokenHash,
      expiresAt,
      requestIp: params.ip ?? undefined,
      userAgent: params.userAgent ?? undefined,
    },
  });

  return { token: rawToken, expiresAt, recordId: token.id };
}

export async function findValidPasswordResetToken(rawToken: string) {
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });
}

export async function markPasswordResetTokenConsumed(tokenId: string) {
  return prisma.passwordResetToken.update({
    where: { id: tokenId },
    data: { consumedAt: new Date() },
  });
}

export async function getLatestResetRequest(userId: string) {
  return prisma.passwordResetToken.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeOtherActiveResetTokens(params: {
  userId: string;
  excludeTokenId?: string;
}) {
  return prisma.passwordResetToken.deleteMany({
    where: {
      userId: params.userId,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      ...(params.excludeTokenId
        ? {
            NOT: {
              id: params.excludeTokenId,
            },
          }
        : {}),
    },
  });
}
