import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findPossibleDuplicates,
  showDuplicateCheckDialog,
  useCustomerDuplicateCheck,
} from '../useCustomerDuplicateCheck';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn(),
  useQuery: vi.fn(),
  get: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.useQuery }));
vi.mock('@/lib/alerts', () => ({
  getSwal: async () => ({
    fire: mocks.fire,
    close: mocks.close,
    showLoading: mocks.showLoading,
  }),
}));
vi.mock('@/lib/api/client', () => ({ api: { get: mocks.get } }));

const partialAddress =
  'Pk Kaugnayan, Barangay GPS, General Paulino Santos (Bo. 1), Koronadal City, Mindanao';
const fullAddress =
  'Pk Kaugnayan, Barangay GPS(infront of ferey day care center), General Paulino Santos (Bo. 1), Koronadal City, Mindanao, South Cotabato, 9506';
const jewel = {
  id: 74,
  customerName: 'Jewel Jamora',
  businessName: '',
  phoneNumber: '09182123110',
  address: fullAddress,
  additionalAddresses: [] as string[],
};

describe('customer duplicate evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.useQuery.mockReturnValue({
      refetch: mocks.refetch,
      isLoading: false,
    });
    mocks.refetch.mockResolvedValue({ data: [jewel], isError: false });
    mocks.fire.mockResolvedValue({ isConfirmed: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('warns for the supplied address despite a different name and blank phone', () => {
    const results = findPossibleDuplicates(
      {
        customerName: 'TEST DUPLICATE',
        phoneNumber: '',
        address: partialAddress,
      },
      [jewel]
    );
    expect(results).toHaveLength(1);
    expect(results[0].nameScore).toBe(0);
    expect(results[0].matchedField).toBe('address');
    expect(results[0].details).toContain('kaugnayan');
    expect(results[0].details).not.toContain('%');
  });

  it('uses the best alternate address and ranks agreement across fields first', () => {
    const matches = findPossibleDuplicates(
      {
        customerName: 'Jewel Jamora',
        address: partialAddress,
        phoneNumber: '09182123110',
      },
      [
        {
          ...jewel,
          id: 1,
          customerName: 'Another resident',
          phoneNumber: '',
          address: partialAddress,
        },
        { ...jewel, address: 'Elsewhere', additionalAddresses: [fullAddress] },
      ]
    );
    expect(matches[0].customer.id).toBe(74);
    expect(matches[0].matchedAddress).toBe(fullAddress);
    expect(matches[0].matchingSignalCount).toBe(3);
  });

  it.each(['+63 918 212 3110', '9182123110', '0918-212-3110'])(
    'warns independently for the same normalized phone %s',
    (phoneNumber) => {
      const matches = findPossibleDuplicates(
        { customerName: 'TEST DUPLICATE', phoneNumber, address: '' },
        [jewel]
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].details).toContain('Same normalized phone number');
    }
  );

  it('does not warn from generic locations, weak names or missing phones alone', () => {
    expect(
      findPossibleDuplicates(
        {
          customerName: 'TEST DUPLICATE',
          phoneNumber: '',
          address: 'City Mindanao Philippines',
        },
        [{ ...jewel, address: 'City Mindanao Philippines' }]
      )
    ).toEqual([]);
    expect(
      findPossibleDuplicates(
        { customerName: 'TEST DUPLICATE', phoneNumber: '', address: '' },
        [jewel]
      )
    ).toEqual([]);
  });

  it('shows escaped evidence without identity percentages and preserves Cancel', async () => {
    const matches = findPossibleDuplicates(
      {
        customerName: 'TEST DUPLICATE',
        phoneNumber: '',
        address: partialAddress,
      },
      [
        {
          ...jewel,
          customerName: '<img src=x onerror=alert(1)>',
          additionalAddresses: [],
        },
      ]
    );
    expect(await showDuplicateCheckDialog(matches)).toBe('cancel');
    const dialog = mocks.fire.mock.calls[0][0];
    expect(dialog.html).toContain('Similar address:');
    expect(dialog.html).toContain('&lt;img');
    expect(dialog.html).not.toContain('<img');
    expect(dialog.html).not.toMatch(/\d+%/);
    expect(dialog.confirmButtonText).toContain('Proceed Anyway');
  });

  it.each([false, true])(
    'returns operator confirmation %s after a fresh successful check',
    async (isConfirmed) => {
      mocks.fire.mockResolvedValue({ isConfirmed });
      const { result } = renderHook(() => useCustomerDuplicateCheck());
      const check = result.current.checkForDuplicates({
        customerName: 'TEST DUPLICATE',
        phoneNumber: '',
        address: partialAddress,
      });
      await vi.runAllTimersAsync();
      expect(await check).toBe(isConfirmed);
      expect(mocks.refetch).toHaveBeenCalledWith({ throwOnError: true });
      expect(
        mocks.fire.mock.calls.some(
          ([dialog]) => dialog.title === 'No Duplicates Found'
        )
      ).toBe(false);
    }
  );

  it('requires explicit consent after a failed directory fetch, not a no-match success', async () => {
    mocks.refetch.mockRejectedValue(new Error('Network failed'));
    const { result } = renderHook(() => useCustomerDuplicateCheck());
    const check = result.current.checkForDuplicates({
      customerName: 'TEST DUPLICATE',
      phoneNumber: '',
      address: partialAddress,
    });
    await vi.runAllTimersAsync();
    expect(await check).toBe(false);
    expect(
      mocks.fire.mock.calls.some(
        ([dialog]) => dialog.title === 'Duplicate Check Failed'
      )
    ).toBe(true);
    expect(
      mocks.fire.mock.calls.some(
        ([dialog]) => dialog.title === 'No Duplicates Found'
      )
    ).toBe(false);
  });

  it('waits for the directory before deciding and preserves the selected API domain', async () => {
    let finish: (value: {
      data: (typeof jewel)[];
      isError: boolean;
    }) => void = () => {
      throw new Error('Pending query missing');
    };
    mocks.refetch.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHook(() =>
      useCustomerDuplicateCheck('/api/general-merchandise')
    );
    const check = result.current.checkForDuplicates({
      customerName: 'TEST DUPLICATE',
      phoneNumber: '',
      address: partialAddress,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.fire).toHaveBeenCalledTimes(1);
    finish({ data: [jewel], isError: false });
    await vi.runAllTimersAsync();
    expect(await check).toBe(false);
    expect(mocks.useQuery.mock.calls[0][0].queryKey).toEqual([
      'customers-duplicate-check',
      '/api/general-merchandise',
    ]);
  });

  it('rejects malformed directory responses rather than treating them as empty', async () => {
    const { result } = renderHook(() => useCustomerDuplicateCheck());
    expect(result.current).toBeDefined();
    mocks.get.mockResolvedValue({ success: true, data: {} });
    await expect(mocks.useQuery.mock.calls[0][0].queryFn()).rejects.toThrow(
      'Invalid customer directory response'
    );
  });

  it('only declares no likely matches after a successful empty directory read', async () => {
    mocks.refetch.mockResolvedValue({ data: [], isError: false });
    const { result } = renderHook(() => useCustomerDuplicateCheck());
    const check = result.current.checkForDuplicates({
      customerName: 'New customer',
      phoneNumber: '',
      address: partialAddress,
    });
    await vi.runAllTimersAsync();
    expect(await check).toBe(true);
    expect(
      mocks.fire.mock.calls.some(
        ([dialog]) => dialog.title === 'No Duplicates Found'
      )
    ).toBe(true);
  });

  it('does not independently warn for short phone suffixes and keeps the five-candidate bound', () => {
    expect(
      findPossibleDuplicates(
        { customerName: 'TEST DUPLICATE', phoneNumber: '3110', address: '' },
        [jewel]
      )
    ).toEqual([]);
    const matches = findPossibleDuplicates(
      {
        customerName: 'TEST DUPLICATE',
        phoneNumber: '',
        address: partialAddress,
      },
      Array.from({ length: 8 }, (_, index) => ({ ...jewel, id: 8 - index }))
    );
    expect(matches).toHaveLength(5);
    expect(matches.map((match) => match.customer.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
