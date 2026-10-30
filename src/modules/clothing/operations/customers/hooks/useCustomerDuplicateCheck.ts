/**
 * Customer Duplicate Check Hook
 *
 * Finds potential duplicate customers before saving a new customer
 * by comparing addresses, phone numbers, and names using fuzzy matching
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import {
  calculateAddressSimilarity,
  calculatePhoneSimilarity,
  calculateNameSimilarity,
} from '@/lib/utils/fuzzyMatch';
import { getSwal } from '@/lib/alerts';
import {
  compareCustomerAddresses,
  customerAddressTerms,
  normalizeCustomerPhone,
} from '@/lib/utils/customerAddressMatch';
import { escapeHtml } from '@/lib/security/sanitize';

interface CustomerData {
  id: number;
  customerName: string;
  businessName: string;
  phoneNumber: string;
  address: string;
  additionalAddresses?: string[];
}

type CustomerWithAddressesRecord = {
  id: number;
  customerName: string;
  businessName: string;
  phoneNumber: string;
  address: string;
  additionalAddresses: string[];
};

type CustomerWithAddressesApiResponse = {
  success: boolean;
  data?: {
    customers: CustomerWithAddressesRecord[];
  };
};

interface PossibleDuplicate {
  customer: CustomerData;
  similarityScore: number;
  matchedField: 'address' | 'phone' | 'name' | 'multiple';
  addressScore: number;
  phoneScore: number;
  nameScore: number;
  details: string;
  matchedAddress: string;
  matchingSignalCount: number;
}

interface NewCustomerData {
  customerName: string;
  phoneNumber: string;
  address: string;
}

/**
 * Fetch all customers with addresses for duplicate checking
 */
async function fetchCustomersForDuplicateCheck(
  apiBasePath?: string
): Promise<CustomerData[]> {
  try {
    const response = await api.get<CustomerWithAddressesApiResponse>(
      buildApiPath(apiBasePath, '/customers/with-all-addresses'),
      { unwrapApiResponse: false }
    );

    if (!response.success || !response.data) {
      throw new Error('Invalid response from API');
    }

    const customers = response.data.customers;
    if (!Array.isArray(customers)) {
      throw new Error('Invalid customer directory response');
    }

    return customers.map((c) => ({
      id: c.id,
      customerName: c.customerName || '',
      businessName: c.businessName || '',
      phoneNumber: c.phoneNumber || '',
      address: c.address || '',
      additionalAddresses: c.additionalAddresses || [],
    }));
  } catch (error) {
    logger.error('Failed to fetch customers for duplicate check:', error);
    throw error;
  }
}

/**
 * Find possible duplicate customers
 */
export function findPossibleDuplicates(
  newCustomer: NewCustomerData,
  existingCustomers: CustomerData[]
): PossibleDuplicate[] {
  const matches: PossibleDuplicate[] = [];

  for (const customer of existingCustomers) {
    // Calculate similarity scores
    const addressScore = calculateAddressSimilarity(
      newCustomer.address,
      customer.address
    );

    const phoneScore = calculatePhoneSimilarity(
      newCustomer.phoneNumber,
      customer.phoneNumber
    );

    const rawNameScore = calculateNameSimilarity(
      newCustomer.customerName,
      customer.customerName
    );
    const nameScore = rawNameScore >= 70 ? rawNameScore : 0;
    const newPhone = normalizeCustomerPhone(newCustomer.phoneNumber);
    const existingPhone = normalizeCustomerPhone(customer.phoneNumber);
    const exactPhone = newPhone.length >= 7 && newPhone === existingPhone;
    const addressCandidates = [
      customer.address,
      ...(customer.additionalAddresses ?? []),
    ]
      .map((address) => ({
        address,
        evidence: compareCustomerAddresses(newCustomer.address, address),
      }))
      .filter((entry) => entry.evidence !== null)
      .sort(
        (left, right) =>
          (right.evidence?.similarityScore ?? 0) -
          (left.evidence?.similarityScore ?? 0)
      );
    const addressCandidate = addressCandidates[0];

    // Check additional addresses if available
    let maxAddressScore = addressScore;
    if (
      customer.additionalAddresses &&
      customer.additionalAddresses.length > 0
    ) {
      const additionalAddressScores = customer.additionalAddresses.map((addr) =>
        calculateAddressSimilarity(newCustomer.address, addr)
      );
      maxAddressScore = Math.max(addressScore, ...additionalAddressScores);
    }
    if (customerAddressTerms(newCustomer.address).length < 3) {
      maxAddressScore = 0;
    }

    // Calculate overall similarity (weighted average)
    const overallScore = Math.round(
      maxAddressScore * 0.6 + // Address is most important
        phoneScore * 0.25 + // Phone is secondary
        nameScore * 0.15 // Name is least reliable
    );

    // Only include if overall score is above threshold (50% for duplicates - higher than dispatch)
    if (overallScore >= 50 || addressCandidate || exactPhone) {
      let matchedField: 'address' | 'phone' | 'name' | 'multiple' = 'address';
      const highScores = [
        { field: 'address' as const, score: maxAddressScore },
        { field: 'phone' as const, score: phoneScore },
        { field: 'name' as const, score: nameScore },
      ].filter((s) => s.score >= 70);

      if (highScores.length > 1) {
        matchedField = 'multiple';
      } else if (highScores.length === 1) {
        matchedField = highScores[0].field;
      }

      // Generate details string
      const details = [];
      if (addressCandidate?.evidence) {
        details.push(
          `Similar address: ${addressCandidate.evidence.matchedTerms.join(', ')}`
        );
      } else if (maxAddressScore >= 60) {
        details.push('Similar address text');
      }
      if (exactPhone) {
        details.push('Same normalized phone number');
      } else if (phoneScore >= 60) {
        details.push('Partially similar phone number');
      }
      if (nameScore >= 70) {
        details.push('Similar name');
      }
      const matchingSignalCount =
        Number(Boolean(addressCandidate) || maxAddressScore >= 70) +
        Number(exactPhone || phoneScore >= 70) +
        Number(nameScore >= 70);
      if (addressCandidate && highScores.length === 0) {
        matchedField = 'address';
      }
      if (exactPhone && !addressCandidate && nameScore < 70) {
        matchedField = 'phone';
      }
      if (matchingSignalCount > 1) {
        matchedField = 'multiple';
      }

      matches.push({
        customer,
        similarityScore: Math.max(
          overallScore,
          addressCandidate?.evidence?.similarityScore ?? 0,
          exactPhone ? 100 : 0
        ),
        matchedField,
        addressScore: maxAddressScore,
        phoneScore,
        nameScore,
        details: details.join(' • '),
        matchedAddress: addressCandidate?.address ?? customer.address,
        matchingSignalCount,
      });
    }
  }

  // Sort by similarity score (highest first) and return top 5
  return matches
    .sort(
      (a, b) =>
        b.matchingSignalCount - a.matchingSignalCount ||
        b.similarityScore - a.similarityScore ||
        a.customer.id - b.customer.id
    )
    .slice(0, 5);
}

/**
 * Show SweetAlert2 popup with duplicate check results
 */
export async function showDuplicateCheckDialog(
  duplicates: PossibleDuplicate[]
): Promise<'proceed' | 'cancel'> {
  const Swal = await getSwal();
  if (duplicates.length === 0) {
    return 'proceed';
  }

  const getScoreColor = (count: number): string =>
    count > 1 ? '#007bff' : '#b7791f';

  // Build HTML content
  const duplicatesHTML = duplicates
    .map(
      (dup) => `
    <div style="
      margin-bottom: 16px;
      padding: 16px;
      border-left: 4px solid ${getScoreColor(dup.matchingSignalCount)};
      background: #f8f9fa;
      border-radius: 8px;
      text-align: left;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="font-size: 16px; color: #212529;">
          ${escapeHtml(dup.customer.customerName)}
          ${dup.customer.businessName ? `<span style="color: #6c757d; font-weight: normal;"> | ${escapeHtml(dup.customer.businessName)}</span>` : ''}
        </strong>
        <span style="
          background: ${getScoreColor(dup.matchingSignalCount)};
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
        ">
          Review suggested
        </span>
      </div>
      <div style="font-size: 14px; color: #495057; margin-bottom: 4px;">
        📞 ${escapeHtml(dup.customer.phoneNumber || 'No phone')}
      </div>
      <div style="font-size: 14px; color: #495057; margin-bottom: 8px;">
        📍 ${escapeHtml(dup.matchedAddress || 'No address')}
      </div>
      ${
        dup.details
          ? `<div style="font-size: 13px; color: #6c757d; font-style: italic;">
          ${escapeHtml(dup.details)}
        </div>`
          : ''
      }
      <div style="margin-top: 8px; font-size: 13px; font-weight: 600; color: ${getScoreColor(dup.matchingSignalCount)};">
        ${dup.matchingSignalCount > 1 ? 'Multiple matching details' : 'Possible match; identity not confirmed'}
      </div>
    </div>
  `
    )
    .join('');

  const result = await Swal.fire({
    title: '⚠️ Possible Duplicate Customer Detected',
    html: `
      <div style="text-align: left;">
        <p style="font-size: 15px; color: #495057; margin-bottom: 20px;">
          We found <strong>${duplicates.length} existing customer${duplicates.length > 1 ? 's' : ''}</strong> 
          that might be similar to the one you're adding. Please review below:
        </p>
        <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
          ${duplicatesHTML}
        </div>
        <p style="font-size: 14px; color: #6c757d; margin-top: 20px; font-style: italic;">
          Shared details do not confirm identity. Verify before saving. If this is a duplicate, click "Cancel" and use the existing customer instead.
        </p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    showConfirmButton: true,
    showLoaderOnConfirm: false,
    confirmButtonText: '✓ Proceed Anyway',
    cancelButtonText: '✕ Cancel',
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#6c757d',
    width: '700px',
    padding: '2rem',
    buttonsStyling: true,
    reverseButtons: true,
    allowOutsideClick: false,
    allowEscapeKey: true,
    focusCancel: true,
  });

  return result.isConfirmed ? 'proceed' : 'cancel';
}

/**
 * Show loading dialog during duplicate check
 */
export async function showCheckingDialog(): Promise<void> {
  const Swal = await getSwal();
  Swal.fire({
    title: 'Checking for Duplicates',
    html: `
      <div style="text-align: center; padding: 20px;">
        <div style="
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        "></div>
        <p style="color: #6c757d; font-size: 15px; margin-top: 20px;">
          Analyzing customer data for possible matches...<br/>
          <span style="font-size: 13px; color: #adb5bd;">This uses sophisticated fuzzy matching algorithms</span>
        </p>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

/**
 * Close the loading dialog
 */
export async function closeCheckingDialog(): Promise<void> {
  const Swal = await getSwal();
  Swal.close();
}

/**
 * Custom hook for customer duplicate checking
 */
export function useCustomerDuplicateCheck(apiBasePath?: string) {
  // Fetch all customers for duplicate checking
  const { refetch, isLoading } = useQuery({
    queryKey: ['customers-duplicate-check', apiBasePath ?? 'default'],
    queryFn: () => fetchCustomersForDuplicateCheck(apiBasePath),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  /**
   * Check for duplicates and show dialog
   * Returns true if user wants to proceed, false if cancelled
   */
  const checkForDuplicates = async (
    newCustomer: NewCustomerData
  ): Promise<boolean> => {
    try {
      // Show loading dialog
      await showCheckingDialog();

      const directory = await refetch({ throwOnError: true });
      if (!directory.data || directory.isError) {
        throw new Error(
          'Could not load the customer directory for duplicate checking'
        );
      }
      const duplicates = findPossibleDuplicates(newCustomer, directory.data);

      // Close loading dialog completely
      await closeCheckingDialog();

      // Small delay to ensure previous dialog is fully closed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // If no duplicates found, proceed immediately
      if (duplicates.length === 0) {
        const Swal = await getSwal();
        await Swal.fire({
          title: 'No Duplicates Found',
          text: 'No likely matches found in the current customer list. Proceeding with save...',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          allowOutsideClick: false,
        });
        return true;
      }

      // Show duplicate dialog and get user decision
      const decision = await showDuplicateCheckDialog(duplicates);
      return decision === 'proceed';
    } catch (error) {
      logger.error('Error during duplicate check:', error);
      await closeCheckingDialog();

      // Small delay before showing error dialog
      await new Promise((resolve) => setTimeout(resolve, 100));

      // On error, ask user if they want to proceed
      const Swal = await getSwal();
      const result = await Swal.fire({
        title: 'Duplicate Check Failed',
        text: 'Could not check for duplicates. Do you want to proceed anyway?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Proceed',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#ffc107',
        allowOutsideClick: false,
      });

      return result.isConfirmed;
    }
  };

  return {
    checkForDuplicates,
    isLoading,
  };
}
