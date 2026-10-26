import { prisma } from '@/lib/db';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  supplierOperationsUser,
  SupplierResolutionError,
} from '@/modules/products/api/supplier-resolution';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async () => {
  try {
    await supplierOperationsUser();
    const credits = await prisma.clothingSupplierCredit.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sourceProduct: {
          select: { id: true, productCode: true, product: true },
        },
        applications: {
          include: {
            targetProduct: { select: { id: true, productCode: true } },
          },
        },
      },
    });
    return ApiResponse.success(
      credits.map((credit) => ({
        ...credit,
        amount: Number(credit.amount),
        availableAmount: Number(credit.availableAmount),
        applications: credit.applications.map((application) => ({
          ...application,
          amount: Number(application.amount),
        })),
      })),
      'Supplier credits fetched'
    );
  } catch (error) {
    if (error instanceof SupplierResolutionError) {
      return ApiResponse.error(error.message, error.status);
    }
    throw error;
  }
});
