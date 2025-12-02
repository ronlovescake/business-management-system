/**
 * Customer Duplicate Check Hook
 *
 * Finds potential duplicate customers before saving a new customer
 * by comparing addresses, phone numbers, and names using fuzzy matching
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import {
  calculateAddressSimilarity,
  calculatePhoneSimilarity,
  calculateNameSimilarity,
} from '@/lib/utils/fuzzyMatch';
import Swal from 'sweetalert2';

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
}

interface NewCustomerData {
  customerName: string;
  phoneNumber: string;
  address: string;
}

/**
 * Fetch all customers with addresses for duplicate checking
 */
async function fetchCustomersForDuplicateCheck(): Promise<CustomerData[]> {
  try {
    const response = await api.get<CustomerWithAddressesApiResponse>(
      '/api/customers/with-all-addresses',
      { unwrapApiResponse: false }
    );

    if (!response.success || !response.data) {
      throw new Error('Invalid response from API');
    }

    const customers = response.data.customers ?? [];

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
function findPossibleDuplicates(
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

    const nameScore = calculateNameSimilarity(
      newCustomer.customerName,
      customer.customerName
    );

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

    // Calculate overall similarity (weighted average)
    const overallScore = Math.round(
      maxAddressScore * 0.6 + // Address is most important
        phoneScore * 0.25 + // Phone is secondary
        nameScore * 0.15 // Name is least reliable
    );

    // Only include if overall score is above threshold (50% for duplicates - higher than dispatch)
    if (overallScore >= 50) {
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
      if (maxAddressScore >= 60) {
        details.push(`Address: ${maxAddressScore}%`);
      }
      if (phoneScore >= 60) {
        details.push(`Phone: ${phoneScore}%`);
      }
      if (nameScore >= 60) {
        details.push(`Name: ${nameScore}%`);
      }

      matches.push({
        customer,
        similarityScore: overallScore,
        matchedField,
        addressScore: maxAddressScore,
        phoneScore,
        nameScore,
        details: details.join(' • '),
      });
    }
  }

  // Sort by similarity score (highest first) and return top 5
  return matches
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 5);
}

/**
 * Show SweetAlert2 popup with duplicate check results
 */
export async function showDuplicateCheckDialog(
  duplicates: PossibleDuplicate[]
): Promise<'proceed' | 'cancel'> {
  if (duplicates.length === 0) {
    return 'proceed';
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) {
      return '#28a745'; // Green
    }
    if (score >= 60) {
      return '#007bff'; // Blue
    }
    return '#ffc107'; // Yellow
  };

  const getScoreBadge = (score: number): string => {
    if (score >= 80) {
      return '🔴 High Risk';
    }
    if (score >= 60) {
      return '🟡 Medium Risk';
    }
    return '🟢 Low Risk';
  };

  // Build HTML content
  const duplicatesHTML = duplicates
    .map(
      (dup) => `
    <div style="
      margin-bottom: 16px;
      padding: 16px;
      border-left: 4px solid ${getScoreColor(dup.similarityScore)};
      background: #f8f9fa;
      border-radius: 8px;
      text-align: left;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="font-size: 16px; color: #212529;">
          ${dup.customer.customerName}
          ${dup.customer.businessName ? `<span style="color: #6c757d; font-weight: normal;"> | ${dup.customer.businessName}</span>` : ''}
        </strong>
        <span style="
          background: ${getScoreColor(dup.similarityScore)};
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
        ">
          ${dup.similarityScore}%
        </span>
      </div>
      <div style="font-size: 14px; color: #495057; margin-bottom: 4px;">
        📞 ${dup.customer.phoneNumber || 'No phone'}
      </div>
      <div style="font-size: 14px; color: #495057; margin-bottom: 8px;">
        📍 ${dup.customer.address || 'No address'}
      </div>
      ${
        dup.details
          ? `<div style="font-size: 13px; color: #6c757d; font-style: italic;">
          ${dup.details}
        </div>`
          : ''
      }
      <div style="margin-top: 8px; font-size: 13px; font-weight: 600; color: ${getScoreColor(dup.similarityScore)};">
        ${getScoreBadge(dup.similarityScore)}
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
          💡 If this is indeed a duplicate, click "Cancel" and use the existing customer instead.
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
export function showCheckingDialog(): void {
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
export function closeCheckingDialog(): void {
  Swal.close();
}

/**
 * Custom hook for customer duplicate checking
 */
export function useCustomerDuplicateCheck() {
  // Fetch all customers for duplicate checking
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers-duplicate-check'],
    queryFn: fetchCustomersForDuplicateCheck,
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
      showCheckingDialog();

      // Add a small delay to ensure loading dialog is shown
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Find possible duplicates
      const duplicates = findPossibleDuplicates(newCustomer, customers);

      // Close loading dialog completely
      Swal.close();

      // Small delay to ensure previous dialog is fully closed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // If no duplicates found, proceed immediately
      if (duplicates.length === 0) {
        await Swal.fire({
          title: 'No Duplicates Found',
          text: 'This appears to be a new customer. Proceeding with save...',
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
      Swal.close();

      // Small delay before showing error dialog
      await new Promise((resolve) => setTimeout(resolve, 100));

      // On error, ask user if they want to proceed
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
