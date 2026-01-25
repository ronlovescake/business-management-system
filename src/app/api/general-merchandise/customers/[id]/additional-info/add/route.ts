import type { NextRequest } from 'next/server';
import type { AdditionalCustomerInfo } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizeString, sanitizers } from '@/lib/security/sanitize';
import {
  customerAdditionalInfoAddSchema,
  type CustomerAdditionalInfoAddInput,
  formatValidationErrors,
} from '@/lib/validations/customer.validation';

type RouteContext = { params: { id: string } };

const TYPE_CONFIG = {
  address: {
    label: 'address',
    sanitize: (value: unknown) => sanitizers.address(value),
  },
  phone: {
    label: 'phone number',
    sanitize: (value: unknown) => sanitizers.phone(value),
  },
  shopee_username: {
    label: 'Shopee username',
    sanitize: (value: unknown) =>
      sanitizeString(value, { maxLength: 255 })?.toLowerCase(),
  },
} as const;

type AdditionalInfoType = keyof typeof TYPE_CONFIG;

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: typeof prisma.customer;
  generalMerchandiseAdditionalCustomerInfo: typeof prisma.additionalCustomerInfo;
};

export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const body = await request.json();
    const validation = customerAdditionalInfoAddSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('GM customer additional info add validation failed', {
        customerId: idResult.id,
        issues: validation.error.issues,
      });
      return ApiResponse.badRequest(
        'Validation failed',
        formatValidationErrors(validation.error)
      );
    }

    const customer = await gmPrisma.generalMerchandiseCustomer.findUnique({
      where: { id: idResult.id },
      select: { id: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const sanitized = sanitizePayload(validation.data);
    if ('error' in sanitized) {
      return sanitized.error;
    }

    const existing = await findExistingEntry(
      idResult.id,
      sanitized.type,
      sanitized.value
    );

    if (existing) {
      logger.info('GM additional info already exists', {
        customerId: idResult.id,
        type: sanitized.type,
      });
      return ApiResponse.success(
        buildResponsePayload(true, sanitized.type, existing),
        `${TYPE_CONFIG[sanitized.type].label} already exists`
      );
    }

    const created =
      await gmPrisma.generalMerchandiseAdditionalCustomerInfo.create({
        data: {
          customerId: idResult.id,
          type: sanitized.type,
          value: sanitized.value,
        },
      });

    logger.info('GM additional customer info added', {
      customerId: idResult.id,
      type: sanitized.type,
    });

    return ApiResponse.success(
      buildResponsePayload(false, sanitized.type, created),
      `${TYPE_CONFIG[sanitized.type].label} added successfully`,
      201
    );
  }
);

function parseCustomerId(
  context?: RouteContext
): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const idParam = context?.params?.id ?? '';
  const customerId = Number(idParam);

  if (!idParam || Number.isNaN(customerId)) {
    return {
      error: ApiResponse.badRequest('Invalid customer ID', {
        id: 'Provide a numeric customer ID in the URL path.',
      }),
    };
  }

  return { id: customerId };
}

function sanitizePayload(
  payload: CustomerAdditionalInfoAddInput
):
  | { type: AdditionalInfoType; value: string }
  | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const config = TYPE_CONFIG[payload.type];
  const sanitizedValue = config.sanitize(payload.value);

  if (!sanitizedValue) {
    return {
      error: ApiResponse.badRequest('Invalid value provided', {
        value: `Unable to parse ${config.label}. Please provide a valid value.`,
      }),
    };
  }

  return { type: payload.type, value: sanitizedValue };
}

async function findExistingEntry(
  customerId: number,
  type: AdditionalInfoType,
  value: string
) {
  if (type === 'shopee_username') {
    return gmPrisma.generalMerchandiseAdditionalCustomerInfo.findFirst({
      where: {
        customerId,
        type,
        value: { equals: value, mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  return gmPrisma.generalMerchandiseAdditionalCustomerInfo.findFirst({
    where: {
      customerId,
      type,
      value,
      deletedAt: null,
    },
  });
}

function buildResponsePayload(
  alreadyExists: boolean,
  type: AdditionalInfoType,
  info: AdditionalCustomerInfo | null
) {
  return {
    alreadyExists,
    message: alreadyExists
      ? `This ${TYPE_CONFIG[type].label} already exists for this customer`
      : `${TYPE_CONFIG[type].label} added successfully`,
    info: info
      ? {
          id: info.id,
          customerId: info.customerId,
          type: info.type,
          value: info.value,
        }
      : undefined,
  };
}
