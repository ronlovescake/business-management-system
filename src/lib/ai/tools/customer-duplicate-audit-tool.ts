import { prisma } from '@/lib/db';
import {
  compareCustomerAddresses,
  customerAddressTerms,
  normalizeCustomerPhone,
} from '@/lib/utils/customerAddressMatch';
import type { AiToolDefinition } from '../types';
import { assertBusinessUnitAccessLocal } from './investigative-access';

export interface CustomerDuplicateAuditResult {
  businessUnit: 'clothing';
  scannedCustomers: number;
  scanLimitReached: boolean;
  comparisonLimitReached: boolean;
  comparisons: number;
  matchedPairCount: number;
  pairs: Array<{
    customers: Array<{ name: string; status: string; banned: boolean }>;
    sharedPhone: string | null;
    addressEvidence: {
      firstAddress: string;
      secondAddress: string;
      sharedTerms: string[];
    } | null;
  }>;
  sourceLink: string;
  warning: string;
}

export function isCustomerDuplicateAuditQuestion(question: string): boolean {
  return (
    /\bduplicates?\b/i.test(question) &&
    /\b(?:customers?|clients?)\b/i.test(question) &&
    /\b(?:check|find|audit|scan|review|identify|possible|potential|any|show)\b/i.test(
      question
    ) &&
    !/\b(?:payments?|refunds?|invoices?|transactions?)\b/i.test(question)
  );
}

export const CUSTOMER_DUPLICATE_AUDIT_TOOL: AiToolDefinition = {
  name: 'auditPossibleCustomerDuplicates',
  description:
    'Read-only Clothing directory-wide possible-duplicate audit. Compares normalized phones and specific primary/business/alternate addresses across customers, including existing banned status. Use for requests to find duplicate customer records or possible re-registration under different names. Shared details are not identity proof or proof of ban evasion. Scan and comparison limits are disclosed. Never merge, ban or link records automatically.',
  businessUnits: ['clothing'],
  readOnly: true,
  parameters: {
    type: 'object',
    properties: {
      businessUnit: {
        type: 'string',
        description: 'Must be clothing',
        enum: ['clothing'],
      },
    },
    required: ['businessUnit'],
  },
  execute: async (args, context): Promise<CustomerDuplicateAuditResult> => {
    if (args.businessUnit !== 'clothing') {
      throw new Error('Customer duplicate audit supports Clothing only.');
    }
    assertBusinessUnitAccessLocal(context, 'clothing');
    const customers: Array<{
      id: number;
      customerName: string;
      customerStatus: string;
      phoneNumber: string;
      address: string;
      businessAddress: string;
      additionalCustomerInfo: Array<{ value: string }>;
    }> = [];
    let cursor: number | undefined;
    let scanLimitReached = false;
    while (customers.length < 5000) {
      const rows = await prisma.customer.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          customerName: true,
          customerStatus: true,
          phoneNumber: true,
          address: true,
          businessAddress: true,
          additionalCustomerInfo: {
            where: { type: 'address', deletedAt: null },
            select: { value: true },
          },
        },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
      customers.push(...rows);
      if (rows.length < 500) {
        break;
      }
      cursor = rows[rows.length - 1].id;
      scanLimitReached = customers.length >= 5000;
    }
    const phones = new Map<string, number[]>();
    const addressIndex = new Map<string, Set<number>>();
    const addresses = customers.map((customer) =>
      Array.from(
        new Set(
          [
            customer.address,
            customer.businessAddress,
            ...customer.additionalCustomerInfo.map((entry) => entry.value),
          ].filter((value) => value?.trim())
        )
      )
    );
    const pairs: Array<
      CustomerDuplicateAuditResult['pairs'][number] & { rank: number }
    > = [];
    let comparisons = 0;
    let comparisonLimitReached = false;
    const comparedPairs = new Set<string>();
    const comparePair = (previous: number, index: number): boolean => {
      const key = `${previous}:${index}`;
      if (comparedPairs.has(key)) {
        return true;
      }
      if (comparisons >= 20000) {
        comparisonLimitReached = true;
        return false;
      }
      comparedPairs.add(key);
      comparisons += 1;
      const customer = customers[index];
      const phone = normalizeCustomerPhone(customer.phoneNumber);
      const sharedPhone =
        phone.length >= 7 &&
        normalizeCustomerPhone(customers[previous].phoneNumber) === phone
          ? phone
          : null;
      let addressEvidence: CustomerDuplicateAuditResult['pairs'][number]['addressEvidence'] =
        null;
      for (const firstAddress of addresses[previous]) {
        for (const secondAddress of addresses[index]) {
          const evidence =
            compareCustomerAddresses(firstAddress, secondAddress) ??
            compareCustomerAddresses(secondAddress, firstAddress);
          if (evidence) {
            addressEvidence = {
              firstAddress,
              secondAddress,
              sharedTerms: evidence.matchedTerms,
            };
            break;
          }
        }
        if (addressEvidence) {
          break;
        }
      }
      if (sharedPhone || addressEvidence) {
        const entries = [customers[previous], customer].map((entry) => ({
          name: entry.customerName,
          status: entry.customerStatus,
          banned: entry.customerStatus.trim().toLowerCase() === 'banned',
        }));
        pairs.push({
          customers: entries,
          sharedPhone,
          addressEvidence,
          rank:
            Number(entries.some((entry) => entry.banned)) * 10 +
            Number(Boolean(sharedPhone)) +
            Number(Boolean(addressEvidence)),
        });
      }
      return true;
    };
    for (let index = 0; index < customers.length; index += 1) {
      const phone = normalizeCustomerPhone(customers[index].phoneNumber);
      const phonePeers = phone.length >= 7 ? (phones.get(phone) ?? []) : [];
      for (const previous of phonePeers) {
        if (!comparePair(previous, index)) {
          break;
        }
      }
      if (comparisonLimitReached) {
        break;
      }
      if (phone.length >= 7) {
        phones.set(phone, [...phonePeers, index]);
      }
    }
    for (
      let index = 0;
      index < customers.length && !comparisonLimitReached;
      index += 1
    ) {
      const candidates = new Set<number>();
      const termCounts = new Map<number, number>();
      const customerTerms = Array.from(
        new Set(addresses[index].flatMap(customerAddressTerms))
      );
      for (const term of customerTerms) {
        addressIndex
          .get(term)
          ?.forEach((previous) =>
            termCounts.set(previous, (termCounts.get(previous) ?? 0) + 1)
          );
      }
      termCounts.forEach((count, previous) => {
        if (count >= 3) {
          candidates.add(previous);
        }
      });
      for (const previous of Array.from(candidates)) {
        if (!comparePair(previous, index)) {
          break;
        }
      }
      if (comparisonLimitReached) {
        break;
      }
      for (const term of customerTerms) {
        const entries = addressIndex.get(term) ?? new Set<number>();
        entries.add(index);
        addressIndex.set(term, entries);
      }
    }
    pairs.sort((left, right) => right.rank - left.rank);
    return {
      businessUnit: 'clothing',
      scannedCustomers: customers.length,
      scanLimitReached,
      comparisonLimitReached,
      comparisons,
      matchedPairCount: pairs.length,
      pairs: pairs.slice(0, 50).map(({ rank: _rank, ...pair }) => pair),
      sourceLink: '/clothing/operations/customers',
      warning:
        'Possible duplicates only. Shared phones/addresses and existing banned status do not prove identity or ban evasion. Verify independently. No records were changed. Counts cover only the scanned and compared records.',
    };
  },
};

function cell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\`*_\[\]])/g, '\\$1');
}

export function formatCustomerDuplicateAudit(
  result: CustomerDuplicateAuditResult
): string {
  const rows = result.pairs.map(
    (pair) =>
      `| ${pair.customers.map((entry) => `${cell(entry.name)} (${cell(entry.status || 'Status not recorded')})`).join(' / ')} | ${pair.sharedPhone ? `Same normalized phone: ${cell(pair.sharedPhone)}` : ''}${pair.sharedPhone && pair.addressEvidence ? '; ' : ''}${pair.addressEvidence ? `Shared address terms: ${pair.addressEvidence.sharedTerms.map(cell).join(', ')}. ${cell(pair.addressEvidence.firstAddress)} / ${cell(pair.addressEvidence.secondAddress)}` : ''} |`
  );
  return [
    '### Clothing — Possible Customer Duplicates',
    `Scanned **${result.scannedCustomers} customers** and compared **${result.comparisons} candidate pairs**. Found **${result.matchedPairCount} possible pairs**; showing **${result.pairs.length}**.`,
    result.scanLimitReached || result.comparisonLimitReached
      ? '**Partial audit:** a scan or comparison limit was reached; this is not exhaustive.'
      : 'Results cover the scanned customer directory under the documented matching rules; they do not prove that no other duplicates exist.',
    rows.length
      ? [
          '| Customers / Recorded Status | Matching Evidence |',
          '| --- | --- |',
          ...rows,
        ].join('\n')
      : 'No possible pairs met the phone/address matching rules in the completed comparisons.',
    result.warning,
    '[Review Clothing customers](/clothing/operations/customers).',
  ].join('\n\n');
}
