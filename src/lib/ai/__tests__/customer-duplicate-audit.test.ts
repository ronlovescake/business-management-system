import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: { customer: { findMany: mock.findMany } },
}));
import {
  CUSTOMER_DUPLICATE_AUDIT_TOOL,
  formatCustomerDuplicateAudit,
  isCustomerDuplicateAuditQuestion,
  type CustomerDuplicateAuditResult,
} from '../tools/customer-duplicate-audit-tool';

const context = {
  userId: 'admin',
  userRole: 'SUPER_ADMIN',
  accessibleModules: [],
  allowedBusinessUnits: ['clothing' as const],
};
const row = (id: number, overrides = {}) => ({
  id,
  customerName: `Customer ${id}`,
  customerStatus: 'Active',
  phoneNumber: '',
  address: '',
  businessAddress: '',
  additionalCustomerInfo: [],
  ...overrides,
});

describe('bounded Clothing customer duplicate audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.findMany.mockResolvedValue([]);
  });
  it('rejects unauthorized and sibling-domain requests before reading data', async () => {
    await expect(
      CUSTOMER_DUPLICATE_AUDIT_TOOL.execute(
        { businessUnit: 'clothing' },
        { ...context, allowedBusinessUnits: [] }
      )
    ).rejects.toThrow(/Access denied/);
    await expect(
      CUSTOMER_DUPLICATE_AUDIT_TOOL.execute(
        { businessUnit: 'general-merchandise' },
        context
      )
    ).rejects.toThrow(/Clothing only/);
    expect(mock.findMany).not.toHaveBeenCalled();
  });
  it('requires active customer and alternate-address filters and reports an empty scan honestly', async () => {
    const result = (await CUSTOMER_DUPLICATE_AUDIT_TOOL.execute(
      { businessUnit: 'clothing' },
      context
    )) as CustomerDuplicateAuditResult;
    expect(mock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        select: expect.objectContaining({
          additionalCustomerInfo: expect.objectContaining({
            where: { type: 'address', deletedAt: null },
          }),
        }),
      })
    );
    expect(result).toMatchObject({
      scannedCustomers: 0,
      pairs: [],
      comparisonLimitReached: false,
    });
    expect(formatCustomerDuplicateAudit(result)).toContain('do not prove');
  });
  it('finds address-only pairs with different names and ignores blank phones and generic regions', async () => {
    const address =
      'Pk Kaugnayan Barangay GPS General Paulino Santos Koronadal City';
    mock.findMany.mockResolvedValue([
      row(1, { address }),
      row(2, { additionalCustomerInfo: [{ value: address }] }),
      row(3, { address: 'City Mindanao Philippines' }),
    ]);
    const result = (await CUSTOMER_DUPLICATE_AUDIT_TOOL.execute(
      { businessUnit: 'clothing' },
      context
    )) as CustomerDuplicateAuditResult;
    expect(result.matchedPairCount).toBe(1);
    expect(result.pairs[0].sharedPhone).toBeNull();
    expect(result.pairs[0].addressEvidence).not.toBeNull();
  });
  it('caps comparisons, report rows and directory scans without claiming completeness', async () => {
    mock.findMany.mockImplementation(
      async (query: { cursor?: { id: number } }) =>
        Array.from({ length: 500 }, (_, index) =>
          row((query.cursor?.id ?? 0) + index + 1, {
            phoneNumber: '09182123110',
          })
        )
    );
    const result = (await CUSTOMER_DUPLICATE_AUDIT_TOOL.execute(
      { businessUnit: 'clothing' },
      context
    )) as CustomerDuplicateAuditResult;
    expect(result.scannedCustomers).toBe(5000);
    expect(result.scanLimitReached).toBe(true);
    expect(result.comparisonLimitReached).toBe(true);
    expect(result.comparisons).toBe(20000);
    expect(result.pairs).toHaveLength(50);
    expect(formatCustomerDuplicateAudit(result)).toContain('Partial audit');
    expect(mock.findMany).toHaveBeenCalledTimes(10);
  });
  it('checks late exact-phone pairs before exhausting the address comparison budget', async () => {
    mock.findMany.mockResolvedValue([
      ...Array.from({ length: 205 }, (_, index) =>
        row(index + 1, {
          address:
            'Pk Kaugnayan Barangay GPS General Paulino Santos Koronadal City',
        })
      ),
      row(206, {
        customerName: 'Late banned customer',
        customerStatus: 'Banned',
        phoneNumber: '09182123110',
      }),
      row(207, { customerName: 'Late alias', phoneNumber: '+639182123110' }),
    ]);
    const result = (await CUSTOMER_DUPLICATE_AUDIT_TOOL.execute(
      { businessUnit: 'clothing' },
      context
    )) as CustomerDuplicateAuditResult;
    expect(result.comparisonLimitReached).toBe(true);
    expect(result.pairs[0].sharedPhone).toBe('09182123110');
    expect(result.pairs[0].customers[0].name).toBe('Late banned customer');
  });

  it('recognizes audit requests without hijacking named-customer or payment questions', () => {
    expect(
      isCustomerDuplicateAuditQuestion(
        'Can you check customers for possible duplicates?'
      )
    ).toBe(true);
    expect(
      isCustomerDuplicateAuditQuestion(
        'How many orders does customer Test Duplicate have?'
      )
    ).toBe(false);
    expect(
      isCustomerDuplicateAuditQuestion(
        'Check duplicate payments for this customer'
      )
    ).toBe(false);
  });
});
