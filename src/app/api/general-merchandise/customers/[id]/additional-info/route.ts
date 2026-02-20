import type { NextRequest } from 'next/server';
import type { AdditionalCustomerInfo, Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizeString, sanitizers } from '@/lib/security/sanitize';
import {
  customerAdditionalInfoSchema,
  type CustomerAdditionalInfoInput,
  formatValidationErrors,
} from '@/lib/validations/customer.validation';

type RouteContext = { params: { id: string } };

type AdditionalInfoEntry = {
  id: string;
  value: string;
};

type AdditionalCustomerInfoResponse = {
  addresses: AdditionalInfoEntry[];
  phones: AdditionalInfoEntry[];
  shopeeUsernames: AdditionalInfoEntry[];
  alternateNames: AdditionalInfoEntry[];
  facebookAccounts: AdditionalInfoEntry[];
};

type AdditionalInfoCategory = keyof CustomerAdditionalInfoInput;

const ADDITIONAL_INFO_TYPE_CONFIG = {
  addresses: { type: 'address', sanitizer: sanitizers.address },
  phones: { type: 'phone', sanitizer: sanitizers.phone },
  shopeeUsernames: { type: 'shopee_username', sanitizer: sanitizers.name },
  alternateNames: { type: 'alternate_name', sanitizer: sanitizers.name },
  facebookAccounts: { type: 'facebook', sanitizer: sanitizers.name },
} as const satisfies Record<
  AdditionalInfoCategory,
  { type: string; sanitizer: (value: unknown) => string }
>;

export const GET = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const customer = await prisma.generalMerchandiseCustomer.findUnique({
      where: { id: idResult.id },
      select: { id: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const additionalInfo =
      await prisma.generalMerchandiseAdditionalCustomerInfo.findMany({
        where: {
          customerId: idResult.id,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

    const grouped = groupAdditionalCustomerInfo(additionalInfo);

    logger.info('GM additional customer info fetched', {
      customerId: idResult.id,
      counts: Object.fromEntries(
        Object.entries(grouped).map(([key, value]) => [key, value.length])
      ),
    });

    return ApiResponse.success(grouped, 'Additional customer info fetched');
  }
);

export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const body = await request.json();
    const validation = customerAdditionalInfoSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('GM customer additional info validation failed', {
        customerId: idResult.id,
        issues: validation.error.issues,
      });
      return ApiResponse.badRequest(
        'Validation failed',
        formatValidationErrors(validation.error)
      );
    }

    const customer = await prisma.generalMerchandiseCustomer.findUnique({
      where: { id: idResult.id },
      select: { id: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const entries = buildAdditionalInfoEntries(validation.data, idResult.id);
    const operations: Array<Prisma.PrismaPromise<unknown>> = [
      prisma.generalMerchandiseAdditionalCustomerInfo.updateMany({
        where: { customerId: idResult.id },
        data: { deletedAt: new Date() },
      }),
    ];

    if (entries.length) {
      operations.push(
        prisma.generalMerchandiseAdditionalCustomerInfo.createMany({
          data: entries,
        })
      );
    }

    operations.push(
      prisma.generalMerchandiseAdditionalCustomerInfo.findMany({
        where: { customerId: idResult.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    );

    const results = await prisma.$transaction(operations);
    const latestInfo = (results.at(-1) as AdditionalCustomerInfo[]) ?? [];
    const grouped = groupAdditionalCustomerInfo(latestInfo);

    logger.info('GM additional customer info saved', {
      customerId: idResult.id,
      newEntries: entries.length,
    });

    return ApiResponse.success(
      grouped,
      entries.length
        ? 'Additional customer info saved successfully'
        : 'Additional customer info cleared successfully'
    );
  }
);

function groupAdditionalCustomerInfo(
  additionalInfo: AdditionalCustomerInfo[]
): AdditionalCustomerInfoResponse {
  return additionalInfo.reduce<AdditionalCustomerInfoResponse>((acc, info) => {
    const entry = {
      id: info.id.toString(),
      value: sanitizeDisplayValue(info.value ?? ''),
    } satisfies AdditionalInfoEntry;

    switch (info.type) {
      case 'address':
        acc.addresses.push(entry);
        break;
      case 'phone':
        acc.phones.push(entry);
        break;
      case 'shopee_username':
        acc.shopeeUsernames.push(entry);
        break;
      case 'alternate_name':
        acc.alternateNames.push(entry);
        break;
      case 'facebook':
        acc.facebookAccounts.push(entry);
        break;
      default:
        break;
    }

    return acc;
  }, createEmptyAdditionalInfoResponse());
}

function createEmptyAdditionalInfoResponse(): AdditionalCustomerInfoResponse {
  return {
    addresses: [],
    phones: [],
    shopeeUsernames: [],
    alternateNames: [],
    facebookAccounts: [],
  };
}

function sanitizeDisplayValue(value: string): string {
  return sanitizeString(value, { maxLength: 500, allowSpecialChars: true });
}

function buildAdditionalInfoEntries(
  payload: CustomerAdditionalInfoInput,
  customerId: number
): Array<{ customerId: number; type: string; value: string }> {
  const entries: Array<{ customerId: number; type: string; value: string }> =
    [];

  (
    Object.keys(ADDITIONAL_INFO_TYPE_CONFIG) as AdditionalInfoCategory[]
  ).forEach((category) => {
    const config = ADDITIONAL_INFO_TYPE_CONFIG[category];
    const values = payload[category] ?? [];

    values.forEach((value) => {
      const sanitizedValue = config.sanitizer(value).trim();
      if (!sanitizedValue) {
        return;
      }

      entries.push({
        customerId,
        type: config.type,
        value: sanitizedValue,
      });
    });
  });

  return entries;
}

function parseCustomerId(
  context?: RouteContext
): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const idParam = context?.params?.id ?? '';
  const id = Number(idParam);

  if (!idParam || Number.isNaN(id)) {
    return {
      error: ApiResponse.badRequest('Invalid customer ID', {
        id: 'Provide a numeric customer ID in the URL path.',
      }),
    };
  }

  return { id };
}
