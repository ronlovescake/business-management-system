'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { TransactionService } from '../services/TransactionService';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import { queryKeys } from '@/lib/queryKeys';
import type { TransactionData } from '../types/transaction.types';
import { logDocumentGenerationNotification } from './documentGenerationNotifications';

interface UsePackingListGenerationProps {
  transactions: TransactionData[];
  bulkUpdate: (data: TransactionData[]) => void;
  apiBasePath?: string;
  saveTransactionToDatabase: (transaction: TransactionData) => Promise<unknown>;
}

interface UsePackingListGenerationReturn {
  isGeneratingPackingList: boolean;
  preparePackingListGeneration: (
    visibleTransactions: TransactionData[],
    options?: PackingListGenerationOptions
  ) => Promise<void>;
}

interface PackingListGenerationOptions {
  dispatchOnly?: boolean;
}

type DispatchCustomerLookup = {
  dispatchCustomerNames: Set<string>;
  normalizedDispatchCustomerNames: Set<string>;
  dispatchOrderCount: number;
  dispatchUsernameCount: number;
};

type CustomerRecord = {
  id: number;
  customerName: string;
  businessName: string;
  shopeeUsernames: string[];
};

const PACKING_LIST_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatPackingListDatePart(date: Date) {
  const month = PACKING_LIST_MONTHS[date.getMonth()] ?? 'UnknownMonth';
  return `${month}_${date.getDate()}`;
}

function toSafeFilenamePart(value: string) {
  return (value || '')
    .trim()
    .replace(/\s*\|\s*/g, '_')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildPackingListFilename(params: {
  customerNames: Array<string | null | undefined>;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const datePart = formatPackingListDatePart(now);

  const uniqueCustomersByNormalized = new Map<string, string>();

  for (const rawName of params.customerNames) {
    const name = (rawName || '').trim();
    if (!name) {
      continue;
    }

    const normalized = name.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!uniqueCustomersByNormalized.has(normalized)) {
      uniqueCustomersByNormalized.set(normalized, name);
    }
  }

  if (uniqueCustomersByNormalized.size === 1) {
    const onlyCustomerName = Array.from(
      uniqueCustomersByNormalized.values()
    )[0];
    const safeCustomer = toSafeFilenamePart(onlyCustomerName) || 'Customer';
    return `${safeCustomer}_${datePart}.pdf`;
  }

  return `Packing_lists_${datePart}.pdf`;
}

const normalizeDispatchName = (value: string | null | undefined) =>
  (value || '')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function collectDispatchNameVariants(
  lookup: DispatchCustomerLookup,
  customerName: string | null | undefined,
  businessName: string | null | undefined
) {
  const variants = new Set<string>();

  const sanitizedCustomer = (customerName || '').trim();
  const sanitizedBusiness = (businessName || '').trim();

  if (sanitizedCustomer) {
    variants.add(sanitizedCustomer);
  }

  if (sanitizedBusiness) {
    variants.add(sanitizedBusiness);
  }

  if (sanitizedCustomer && sanitizedBusiness) {
    variants.add(`${sanitizedCustomer} | ${sanitizedBusiness}`);
  }

  variants.forEach((variant) => {
    lookup.dispatchCustomerNames.add(variant);
    const normalized = normalizeDispatchName(variant);
    if (normalized) {
      lookup.normalizedDispatchCustomerNames.add(normalized);
    }
  });
}

function isCustomerInDispatch(
  customerName: string | null | undefined,
  normalizedDispatchCustomerNames: Set<string>
) {
  const transactionNameVariants = new Set<string>();
  const sanitizedName = (customerName || '').trim();

  if (sanitizedName) {
    transactionNameVariants.add(sanitizedName);
    const [primary, secondary] = sanitizedName
      .split('|')
      .map((part) => part.trim());
    if (primary) {
      transactionNameVariants.add(primary);
    }
    if (secondary) {
      transactionNameVariants.add(secondary);
    }
  }

  return Array.from(transactionNameVariants).some((nameVariant) =>
    normalizedDispatchCustomerNames.has(normalizeDispatchName(nameVariant))
  );
}

async function fetchDispatchCustomerLookup(
  apiBasePath: string | undefined
): Promise<DispatchCustomerLookup> {
  const lookup: DispatchCustomerLookup = {
    dispatchCustomerNames: new Set(),
    normalizedDispatchCustomerNames: new Set(),
    dispatchOrderCount: 0,
    dispatchUsernameCount: 0,
  };

  const dispatchResponse = await fetch(
    buildApiPath(apiBasePath, '/dispatch/orders')
  );

  if (!dispatchResponse.ok) {
    throw new Error(
      `Failed to fetch dispatch orders: ${dispatchResponse.statusText}`
    );
  }

  const dispatchData = (await dispatchResponse.json()) as {
    success: boolean;
    data: Array<{ 'Username (Buyer)'?: string | null }>;
  };

  lookup.dispatchOrderCount = dispatchData.data.length;

  const dispatchUsernames = Array.from(
    new Set(
      dispatchData.data
        .map((order) => order['Username (Buyer)'])
        .filter((username): username is string => Boolean(username))
    )
  );

  lookup.dispatchUsernameCount = dispatchUsernames.length;

  if (dispatchUsernames.length === 0) {
    return lookup;
  }

  const customersResponse = await fetch(
    buildApiPath(apiBasePath, '/customers/with-shopee')
  );

  if (!customersResponse.ok) {
    throw new Error(
      `Failed to fetch customers with Shopee usernames: ${customersResponse.statusText}`
    );
  }

  const customersData = (await customersResponse.json()) as {
    success: boolean;
    data: CustomerRecord[] | { customers: CustomerRecord[] };
  };

  const customersPayload = Array.isArray(customersData.data)
    ? customersData.data
    : customersData.data.customers;

  dispatchUsernames.forEach((username) => {
    const normalizedUsername = username.toLowerCase().trim();
    const matchedCustomer = customersPayload.find((customer) =>
      customer.shopeeUsernames
        .map((value) => value.toLowerCase().trim())
        .includes(normalizedUsername)
    );

    if (matchedCustomer) {
      collectDispatchNameVariants(
        lookup,
        matchedCustomer.customerName,
        matchedCustomer.businessName
      );
    }
  });

  return lookup;
}

export function usePackingListGeneration(
  props: UsePackingListGenerationProps
): UsePackingListGenerationReturn {
  const { transactions, bulkUpdate, apiBasePath, saveTransactionToDatabase } =
    props;
  const queryClient = useQueryClient();
  const resolvedApiBasePath = apiBasePath ?? '/api';
  const transactionsQueryKey = useMemo(
    () => [...queryKeys.transactions.lists(), resolvedApiBasePath],
    [resolvedApiBasePath]
  );

  const [isGeneratingPackingList, setIsGeneratingPackingList] = useState(false);

  const getNormalizedStatus = (value: string | null | undefined) =>
    normalizeOrderStatus(value);

  const preparePackingListGeneration = useCallback(
    async (
      visibleTransactions: TransactionData[],
      options: PackingListGenerationOptions = {}
    ) => {
      const Swal = await getSwal();
      let dispatchOnly = options.dispatchOnly === true;
      let dispatchCustomerLookup: DispatchCustomerLookup | null = null;
      const allPrepared = visibleTransactions.filter((transaction) => {
        const status = getNormalizedStatus(transaction['Order Status']);
        return status === 'prepared';
      });

      const customersWithEligiblePrepared = new Set(
        visibleTransactions
          .filter((transaction) => {
            const status = getNormalizedStatus(transaction['Order Status']);
            const lineTotal = Number(transaction['Line Total']) || 0;
            return status === 'prepared' && lineTotal <= 50.0;
          })
          .map((transaction) => transaction.Customers)
          .filter(Boolean)
      );

      const eligible = visibleTransactions.filter((transaction) => {
        const status = getNormalizedStatus(transaction['Order Status']);
        const customerName = transaction.Customers;
        const lineTotal = Number(transaction['Line Total']) || 0;

        if (status === 'prepared' && lineTotal <= 50.0) {
          return true;
        }

        if (
          status === 'on-hold' &&
          customerName &&
          customersWithEligiblePrepared.has(customerName)
        ) {
          return true;
        }

        return false;
      });

      let filteredEligible = eligible;

      if (eligible.length === 0) {
        showNotification({
          title: '⚠️ No Prepared Transactions',
          message:
            'No visible transactions found with "Prepared" status and line total ≤ ₱50.00.',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

      const applyDispatchOnlyFilter = async () => {
        try {
          dispatchCustomerLookup =
            dispatchCustomerLookup ??
            (await fetchDispatchCustomerLookup(apiBasePath));
        } catch (error) {
          logger.error('Error fetching dispatch customers:', error);
          showNotification({
            title: '❌ Unable to Check Dispatch Customers',
            message:
              error instanceof Error
                ? error.message
                : 'Dispatch customer lookup failed.',
            color: 'red',
            autoClose: 7000,
          });
          return false;
        }

        if (dispatchCustomerLookup.normalizedDispatchCustomerNames.size === 0) {
          showNotification({
            title: '⚠️ No Dispatch Customers Found',
            message:
              'No customers from the dispatch table matched customer Shopee usernames.',
            color: 'yellow',
            autoClose: 6000,
          });
          return false;
        }

        const dispatchCustomerNames =
          dispatchCustomerLookup.normalizedDispatchCustomerNames;

        filteredEligible = filteredEligible.filter((transaction) =>
          isCustomerInDispatch(transaction.Customers, dispatchCustomerNames)
        );

        if (filteredEligible.length === 0) {
          showNotification({
            title: '⚠️ No Dispatch Packing List Transactions',
            message:
              'No eligible prepared/on-hold transactions belong to customers found in the dispatch table.',
            color: 'yellow',
            autoClose: 6000,
          });
          return false;
        }

        return true;
      };

      if (dispatchOnly) {
        const hasDispatchTransactions = await applyDispatchOnlyFilter();
        if (!hasDispatchTransactions) {
          return;
        }
      }

      const customersInCurrentRun = new Set(
        filteredEligible.map(
          (transaction) => transaction.Customers || 'Unknown'
        )
      );

      const customerOrdersMap = new Map<
        string,
        { eligible: number; excluded: number }
      >();

      allPrepared.forEach((transaction) => {
        const customerName = transaction.Customers || 'Unknown';
        if (!customersInCurrentRun.has(customerName)) {
          return;
        }

        const lineTotal = Number(transaction['Line Total']) || 0;
        const isEligible = lineTotal <= 50.0;

        if (!customerOrdersMap.has(customerName)) {
          customerOrdersMap.set(customerName, { eligible: 0, excluded: 0 });
        }

        const counts = customerOrdersMap.get(customerName);
        if (counts) {
          if (isEligible) {
            counts.eligible++;
          } else {
            counts.excluded++;
          }
        }
      });

      const customersWithSplitOrders = Array.from(customerOrdersMap.entries())
        .filter(([_, counts]) => counts.eligible > 0 && counts.excluded > 0)
        .map(([customerName, counts]) => ({
          customerName,
          ...counts,
        }));

      if (customersWithSplitOrders.length > 0) {
        const totalExcludedFromSplits = customersWithSplitOrders.reduce(
          (sum, customer) => sum + customer.excluded,
          0
        );

        const customerList = customersWithSplitOrders
          .map(
            (customer) =>
              `<li><strong>${customer.customerName}</strong>: ${customer.eligible} order${customer.eligible > 1 ? 's' : ''} will be included, but ${customer.excluded} order${customer.excluded > 1 ? 's' : ''} will be left behind (> ₱50.00)</li>`
          )
          .join('');

        const splitWarningSelection: {
          action: 'proceed' | 'skip' | 'dispatch' | 'cancel';
        } = { action: 'cancel' };

        await Swal.fire({
          title: '⚠️ Some Customers Have Split Orders',
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 12px;"><strong>${customersWithSplitOrders.length}</strong> customer${customersWithSplitOrders.length > 1 ? 's have' : ' has'} orders that will be <strong>split</strong>:</p>
              <ul style="margin: 12px 0; padding-left: 20px; font-size: 14px; color: #495057;">
                ${customerList}
              </ul>
              <p style="margin-top: 16px; padding: 12px; background-color: #fff3cd; border-radius: 4px; border: 1px solid #ffc107; color: #856404; font-size: 14px;">
                ⚠️ <strong>Warning:</strong> These customers will NOT receive all their orders in this packing list. Make sure to handle the excluded orders separately.
              </p>
              <p style="margin-top: 12px; font-size: 14px;">Total orders excluded from split customers: <strong>${totalExcludedFromSplits}</strong></p>
            </div>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 28px;">
              <button type="button" id="packing-list-proceed" class="swal2-confirm swal2-styled" style="display: inline-block; background-color: #60bd52ff;">Proceed</button>
              <button type="button" id="packing-list-dispatch" class="swal2-deny swal2-styled" style="display: inline-block; background-color: #7950f2;">Dispatch Customers Only</button>
              <button type="button" id="packing-list-skip" class="swal2-deny swal2-styled" style="display: inline-block; background-color: #5198dfff;">Skip These Customers</button>
              <button type="button" id="packing-list-cancel" class="swal2-cancel swal2-styled" style="display: inline-block; background-color: #ff7171ff;">Cancel</button>
            </div>
          `,
          icon: 'warning',
          showConfirmButton: false,
          showDenyButton: false,
          showCancelButton: false,
          width: '813px',
          allowOutsideClick: false,
          didOpen: () => {
            const popup = Swal.getPopup();
            const closeWith = (
              action: 'proceed' | 'skip' | 'dispatch' | 'cancel'
            ) => {
              splitWarningSelection.action = action;
              Swal.close();
            };

            popup
              ?.querySelector('#packing-list-proceed')
              ?.addEventListener('click', () => closeWith('proceed'));
            popup
              ?.querySelector('#packing-list-dispatch')
              ?.addEventListener('click', () => closeWith('dispatch'));
            popup
              ?.querySelector('#packing-list-skip')
              ?.addEventListener('click', () => closeWith('skip'));
            popup
              ?.querySelector('#packing-list-cancel')
              ?.addEventListener('click', () => closeWith('cancel'));
          },
          customClass: {
            popup: 'swal-wide',
          },
        });

        if (splitWarningSelection.action === 'dispatch') {
          dispatchOnly = true;
          const hasDispatchTransactions = await applyDispatchOnlyFilter();
          if (!hasDispatchTransactions) {
            return;
          }
        } else if (splitWarningSelection.action === 'skip') {
          const splitCustomerNames = new Set(
            customersWithSplitOrders.map((customer) => customer.customerName)
          );

          filteredEligible = filteredEligible.filter((transaction) => {
            const customerKey = transaction.Customers || 'Unknown';
            return !splitCustomerNames.has(customerKey);
          });

          if (filteredEligible.length === 0) {
            showNotification({
              title: '⚠️ No Eligible Transactions',
              message:
                'All split-order customers were skipped. No transactions left to process.',
              color: 'yellow',
              autoClose: 5000,
            });
            return;
          }

          showNotification({
            title: 'ℹ️ Split Customers Skipped',
            message:
              'Customers with split orders were excluded from this packing list.',
            color: 'blue',
            autoClose: 5000,
          });
        } else if (splitWarningSelection.action === 'cancel') {
          showNotification({
            title: '✅ Packing List Generation Cancelled',
            message: 'No changes were made.',
            color: 'blue',
            autoClose: 4000,
          });
          return;
        }
      }

      const escapeHtml = (value: string): string =>
        value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

      const uniqueCustomers = new Set(
        filteredEligible
          .map((transaction) => transaction.Customers?.trim())
          .filter(Boolean)
      );

      const customerList = Array.from(uniqueCustomers).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      const customersHtml =
        customerList.length > 0
          ? customerList
              .map((customer) => `<li>${escapeHtml(customer)}</li>`)
              .join('')
          : '<li><em>No customers found</em></li>';
      const totalValue = filteredEligible.reduce(
        (sum, transaction) => sum + (Number(transaction['Line Total']) || 0),
        0
      );

      const preparedCount = filteredEligible.filter(
        (transaction) =>
          getNormalizedStatus(transaction['Order Status']) === 'prepared'
      ).length;
      const onHoldCount = filteredEligible.filter(
        (transaction) =>
          getNormalizedStatus(transaction['Order Status']) === 'on-hold'
      ).length;

      const finalConfirmationSelection: {
        action: 'generate' | 'dispatch' | 'cancel';
      } = { action: 'cancel' };

      await Swal.fire({
        title: dispatchOnly
          ? 'Dispatch Packing List Generation Confirmation'
          : 'Packing List Generation Confirmation',
        html: `
          <div style="text-align: left;">
            <p style="font-weight: 500; margin-bottom: 12px;">You are about to generate packing lists for:</p>
            <div style="margin-bottom: 16px;">
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${filteredEligible.length}</strong> eligible transactions
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${uniqueCustomers.size}</strong> customer${uniqueCustomers.size > 1 ? 's' : ''}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                <strong>${preparedCount}</strong> Prepared order${preparedCount !== 1 ? 's' : ''} and <strong>${onHoldCount}</strong> On-Hold order${onHoldCount !== 1 ? 's' : ''}
              </p>
              <p style="margin: 6px 0; font-size: 14px;">
                Total value: <strong>₱${totalValue.toLocaleString()}</strong>
              </p>
              ${dispatchOnly ? '<p style="margin: 6px 0; font-size: 14px; color: #5f3dc4;"><strong>Dispatch-only:</strong> customers must be found in the dispatch table</p>' : ''}
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="font-weight: 500; margin-bottom: 12px;">Customers:</p>
            <div style="max-height: 160px; overflow: auto; border: 1px solid #dee2e6; border-radius: 12px; padding: 10px; background: #f8f9fa;">
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #495057;">
                ${customersHtml}
              </ul>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">

            <p style="text-align: center; color: #868e96; font-size: 14px; margin: 0;">
              Do you want to proceed with packing list generation?
            </p>

            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 24px;">
              <button type="button" id="packing-list-final-generate" class="swal2-confirm swal2-styled" style="display: inline-block; background-color: #7950f2;">Generate Packing Lists</button>
              ${dispatchOnly ? '' : '<button type="button" id="packing-list-final-dispatch" class="swal2-deny swal2-styled" style="display: inline-block; background-color: #5f3dc4;">Dispatch Customers Only</button>'}
              <button type="button" id="packing-list-final-cancel" class="swal2-cancel swal2-styled" style="display: inline-block; background-color: #868e96;">Cancel</button>
            </div>
          </div>
        `,
        icon: 'question',
        showConfirmButton: false,
        showDenyButton: false,
        showCancelButton: false,
        width: '600px',
        allowOutsideClick: false,
        didOpen: () => {
          const popup = Swal.getPopup();
          const closeWith = (action: 'generate' | 'dispatch' | 'cancel') => {
            finalConfirmationSelection.action = action;
            Swal.close();
          };

          popup
            ?.querySelector('#packing-list-final-generate')
            ?.addEventListener('click', () => closeWith('generate'));
          popup
            ?.querySelector('#packing-list-final-dispatch')
            ?.addEventListener('click', () => closeWith('dispatch'));
          popup
            ?.querySelector('#packing-list-final-cancel')
            ?.addEventListener('click', () => closeWith('cancel'));
        },
        customClass: {
          popup: 'swal-wide',
        },
      });

      if (finalConfirmationSelection.action === 'dispatch') {
        dispatchOnly = true;
        const hasDispatchTransactions = await applyDispatchOnlyFilter();
        if (!hasDispatchTransactions) {
          return;
        }
      } else if (finalConfirmationSelection.action === 'cancel') {
        showNotification({
          title: '✅ Packing List Generation Cancelled',
          message: 'No changes were made.',
          color: 'blue',
          autoClose: 4000,
        });
        return;
      }

      setIsGeneratingPackingList(true);

      try {
        const transformed = filteredEligible.map((transaction) => ({
          Customers: transaction.Customers || '',
          'Product Code': transaction['Product Code'] || '',
          Quantity: Number(transaction.Quantity) || 0,
          Notes: transaction.Notes || '',
        }));

        const response = await fetch(
          buildApiPath(apiBasePath, '/generate-packing-list'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ transactions: transformed }),
          }
        );

        if (response.ok) {
          const pdfBlob = await response.blob();
          const url = window.URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = url;

          const filename = buildPackingListFilename({
            customerNames: filteredEligible.map(
              (transaction) => transaction.Customers
            ),
          });
          link.download = filename;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          showNotification({
            title: '✅ Packing Lists Generated',
            message: `PDF with packing lists for ${filteredEligible.length} transactions downloaded`,
            color: 'green',
            autoClose: 8000,
          });

          await logDocumentGenerationNotification({
            apiBasePath,
            documentType: 'packing-list',
            message: `Packing list PDF generated for ${filteredEligible.length} transaction${filteredEligible.length === 1 ? '' : 's'}.`,
            count: filteredEligible.length,
            filename,
          });

          try {
            dispatchCustomerLookup =
              dispatchCustomerLookup ??
              (await fetchDispatchCustomerLookup(apiBasePath));

            logger.info('✅ Dispatch customer names matched:', {
              count: dispatchCustomerLookup.dispatchCustomerNames.size,
              names: Array.from(dispatchCustomerLookup.dispatchCustomerNames),
              dispatchOrders: dispatchCustomerLookup.dispatchOrderCount,
              dispatchUsernames: dispatchCustomerLookup.dispatchUsernameCount,
            });
          } catch (error) {
            logger.error('Error fetching dispatch data:', error);
          }

          const currentDate = new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Manila',
          });

          const processedIds = new Set(
            filteredEligible.map((transaction) => transaction.id)
          );
          const updated = transactions.map((transaction) => {
            if (processedIds.has(transaction.id)) {
              const customerName = transaction.Customers || '';

              const isInDispatch = Boolean(
                dispatchCustomerLookup &&
                  isCustomerInDispatch(
                    customerName,
                    dispatchCustomerLookup.normalizedDispatchCustomerNames
                  )
              );

              const remainingBalance = Number(transaction['Line Total']) || 0;

              const orderStatus =
                remainingBalance > 0
                  ? 'Pending Payment'
                  : isInDispatch
                    ? 'Checked Out'
                    : 'Ready For Dispatch';

              logger.info(
                `Customer "${customerName}": ${isInDispatch ? '✅ FOUND in dispatch' : '❌ NOT in dispatch'} → Status: ${orderStatus}`
              );

              const packedDate =
                !transaction['Packed Date'] ||
                transaction['Packed Date'].trim() === ''
                  ? currentDate
                  : transaction['Packed Date'];

              return {
                ...transaction,
                'Packed Date': packedDate,
                'Order Status': orderStatus,
              };
            }
            return transaction;
          });

          const toSave = updated.filter(
            (transaction) =>
              processedIds.has(transaction.id) && transaction.id !== undefined
          );

          if (toSave.length > 0) {
            bulkUpdate(TransactionService.sanitizeTransactions(toSave));
          }

          queryClient.setQueryData(
            transactionsQueryKey,
            TransactionService.sanitizeTransactions(updated)
          );

          if (toSave.length > 0) {
            const results = await Promise.allSettled(
              toSave.map((transaction) =>
                saveTransactionToDatabase(transaction)
              )
            );
            const failed = results.filter(
              (result) => result.status === 'rejected'
            );

            if (failed.length > 0) {
              logger.warn('Partial packing list update save failure', {
                failed: failed.length,
                total: results.length,
              });
              showNotification({
                title: '⚠️ Some Packing List Updates Failed to Save',
                message:
                  'Some records did not persist to the database. Please refresh and retry if needed.',
                color: 'yellow',
                autoClose: 8000,
              });
            }

            await queryClient.invalidateQueries({
              queryKey: transactionsQueryKey,
              refetchType: 'active',
            });
            await queryClient.refetchQueries({
              queryKey: transactionsQueryKey,
              type: 'active',
            });
          }
        } else {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(
            errorData.error || 'Failed to generate packing lists'
          );
        }
      } catch (error) {
        logger.error('Error generating packing lists:', error);
        showNotification({
          title: '❌ Packing List Generation Failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
          color: 'red',
          autoClose: 7000,
        });
      } finally {
        setIsGeneratingPackingList(false);
      }
    },
    [
      transactions,
      bulkUpdate,
      saveTransactionToDatabase,
      apiBasePath,
      queryClient,
      transactionsQueryKey,
    ]
  );

  return {
    isGeneratingPackingList,
    preparePackingListGeneration,
  };
}
