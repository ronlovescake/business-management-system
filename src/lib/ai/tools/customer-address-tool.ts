import { prisma } from '@/lib/db';
import {
  compareCustomerAddresses,
  customerAddressTerms,
} from '@/lib/utils/customerAddressMatch';
import type { AiToolDefinition } from '../types';
import {
  assertBusinessUnitAccessLocal,
  normalizeBusinessUnitArg,
} from './investigative-access';

export const CUSTOMER_ADDRESS_TOOL: AiToolDefinition = {
  name: 'findCustomersByAddress',
  description:
    'Find possible customer matches from a waybill or delivery address, including primary, business and additional addresses. Use even when the delivery name is unknown. Results are ranked candidates with shared address terms, never confirmed identities. A similarity score is not a probability. Verify with another detail before dispatching or linking an order.',
  businessUnits: ['clothing', 'general-merchandise'],
  readOnly: true,
  parameters: {
    type: 'object',
    properties: {
      businessUnit: {
        type: 'string',
        description: 'Authorized customer domain',
        enum: ['clothing', 'general-merchandise'],
      },
      address: {
        type: 'string',
        description:
          'Address text only, not the surrounding question. Partial addresses and inserted landmark notes are supported.',
      },
    },
    required: ['businessUnit', 'address'],
  },
  execute: async (args, context) => {
    const unit = normalizeBusinessUnitArg(args.businessUnit);
    assertBusinessUnitAccessLocal(context, unit);
    if (unit === 'trucking') {
      throw new Error(
        'Address matching is available only for Clothing and General Merchandise customer directories.'
      );
    }
    const address = typeof args.address === 'string' ? args.address.trim() : '';
    if (!address || address.length > 500) {
      throw new Error('Provide an address between 1 and 500 characters.');
    }
    const queryTerms = customerAddressTerms(address);
    const sourceLink =
      unit === 'clothing'
        ? '/clothing/operations/customers'
        : '/general-merchandise/operations/customers';
    if (queryTerms.length < 3) {
      return {
        businessUnit: unit,
        candidates: [],
        needsMoreAddressDetails: true,
        sourceLink,
        warning:
          'Provide more distinctive address details; a city or generic region alone cannot identify a customer.',
      };
    }

    const candidates: Array<{
      customerId: number;
      customerName: string;
      matchedAddress: string;
      addressSource: string;
      matchedTerms: string[];
      unmatchedTerms: string[];
      similarityScore: number;
    }> = [];
    let cursor: number | undefined;
    let scannedCustomers = 0;
    let scanLimitReached = false;
    while (scannedCustomers < 5000) {
      const query = {
        where: { deletedAt: null },
        select: {
          id: true,
          customerName: true,
          address: true,
          businessAddress: true,
          additionalCustomerInfo: {
            where: { type: 'address', deletedAt: null },
            select: { value: true },
          },
        },
        orderBy: { id: 'asc' as const },
        take: 500,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      };
      const rows =
        unit === 'clothing'
          ? await prisma.customer.findMany(query)
          : await prisma.generalMerchandiseCustomer.findMany(query);
      scannedCustomers += rows.length;
      for (const customer of rows) {
        const addresses = [
          { source: 'primary', value: customer.address },
          { source: 'business', value: customer.businessAddress },
          ...customer.additionalCustomerInfo.map((entry) => ({
            source: 'additional',
            value: entry.value,
          })),
        ];
        let best: (typeof candidates)[number] | undefined;
        for (const entry of addresses) {
          if (!entry.value?.trim()) {
            continue;
          }
          const evidence = compareCustomerAddresses(address, entry.value);
          if (!evidence) {
            continue;
          }
          const { similarityScore, matchedTerms, unmatchedTerms } = evidence;
          if (!best || similarityScore > best.similarityScore) {
            best = {
              customerId: customer.id,
              customerName: customer.customerName,
              matchedAddress: entry.value,
              addressSource: entry.source,
              matchedTerms,
              unmatchedTerms,
              similarityScore,
            };
          }
        }
        if (best) {
          candidates.push(best);
        }
      }
      if (rows.length < 500) {
        break;
      }
      cursor = rows[rows.length - 1].id;
      scanLimitReached = scannedCustomers >= 5000;
    }
    candidates.sort(
      (left, right) =>
        right.similarityScore - left.similarityScore ||
        left.customerId - right.customerId
    );
    return {
      businessUnit: unit,
      candidates: candidates.slice(0, 5),
      totalCandidates: candidates.length,
      scannedCustomers,
      scanLimitReached,
      sourceLink,
      warning:
        'Possible address matches only, not confirmed identities. Scores measure text similarity, not identity probability. Verify the phone number, recipient or landmark before linking or dispatching. A capped scan is not an exhaustive search.',
    };
  },
};
