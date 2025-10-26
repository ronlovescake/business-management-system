import { PrismaClient } from '@prisma/client';
import {
  applySoftDeleteMiddleware,
  applyAuditLogMiddleware,
} from '@/core/database/middleware';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  });

// Separate client for audit logging to prevent recursion
const auditClient = new PrismaClient();

// Apply middleware
applySoftDeleteMiddleware(prisma);
applyAuditLogMiddleware(prisma, auditClient);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
