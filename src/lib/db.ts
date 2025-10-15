import { PrismaClient } from '@prisma/client';

const softDeleteModels = new Set([
  'Customer',
  'Price',
  'Product',
  'Shipment',
  'Transaction',
  'SortingDistribution',
]);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  });

const auditClient = new PrismaClient();

const ensureWhere = (where: Record<string, unknown> | undefined) => ({
  ...where,
  deletedAt: null,
});

const getDelegate = (client: PrismaClient, modelName: string) =>
  (client as unknown as Record<string, unknown>)[
    modelName.charAt(0).toLowerCase() + modelName.slice(1)
  ] as {
    findFirst?: (args: unknown) => Promise<unknown>;
    findMany?: (args: unknown) => Promise<unknown>;
    create?: (args: unknown) => Promise<unknown>;
  };

prisma.$use(async (params, next) => {
  const model = params.model as string | undefined;

  if (model && softDeleteModels.has(model) && model !== 'AuditLog') {
    switch (params.action) {
      case 'findMany':
      case 'count':
        params.args = params.args ?? {};
        params.args.where = ensureWhere(params.args.where);
        break;
      case 'findFirst':
        params.args = params.args ?? {};
        params.args.where = ensureWhere(params.args.where);
        break;
      case 'findUnique':
        params.action = 'findFirst';
        params.args = params.args ?? {};
        params.args.where = ensureWhere(params.args.where);
        break;
      case 'delete':
        params.action = 'update';
        params.args.data = {
          ...(params.args.data ?? {}),
          deletedAt: new Date(),
        };
        break;
      case 'deleteMany':
        params.action = 'updateMany';
        params.args = params.args ?? {};
        params.args.data = { deletedAt: new Date() };
        break;
      default:
        break;
    }
  }

  let before: unknown = null;
  if (model && model !== 'AuditLog') {
    const delegate = getDelegate(auditClient, model);

    if (delegate) {
      try {
        if (['update', 'delete', 'upsert'].includes(params.action)) {
          before = await delegate.findFirst?.({ where: params.args?.where });
        }

        if (['updateMany', 'deleteMany'].includes(params.action)) {
          before = await delegate.findMany?.({ where: params.args?.where });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          '⚠️ Unable to capture "before" snapshot for audit log.',
          error
        );
      }
    }
  }

  const result = await next(params);

  if (model && model !== 'AuditLog') {
    const auditDelegate = getDelegate(auditClient, 'AuditLog');
    if (auditDelegate?.create) {
      try {
        const targetId =
          (Array.isArray(result)
            ? undefined
            : (result?.id?.toString?.() ??
              params.args?.where?.id?.toString?.())) ?? null;
        await auditDelegate.create({
          data: {
            model,
            action: params.action,
            targetId,
            before,
            after: Array.isArray(result) ? { count: result.length } : result,
          },
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('⚠️ Failed to persist audit log entry.', error);
      }
    }
  }

  return result;
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
