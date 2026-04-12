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

interface UsePackingListGenerationProps {
  transactions: TransactionData[];
  bulkUpdate: (data: TransactionData[]) => void;
  apiBasePath?: string;
  saveTransactionToDatabase: (transaction: TransactionData) => Promise<unknown>;
}

interface UsePackingListGenerationReturn {
  isGeneratingPackingList: boolean;
  preparePackingListGeneration: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
}

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
    async (visibleTransactions: TransactionData[]) => {
      const Swal = await getSwal();
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

      const customerOrdersMap = new Map<
        string,
        { eligible: number; excluded: number }
      >();

      allPrepared.forEach((transaction) => {
        const customerName = transaction.Customers || 'Unknown';
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

        const splitWarningResult = await Swal.fire({
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
          `,
          icon: 'warning',
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'Proceed',
          denyButtonText: 'Skip These Customers',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#60bd52ff',
          denyButtonColor: '#5198dfff',
          cancelButtonColor: '#ff7171ff',
          width: '813px',
          allowOutsideClick: false,
          customClass: {
            popup: 'swal-wide',
          },
        });

        if (splitWarningResult.isDenied) {
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
        } else if (
          splitWarningResult.dismiss === Swal.DismissReason.cancel ||
          splitWarningResult.dismiss === Swal.DismissReason.close
        ) {
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

      const result = await Swal.fire({
        title: 'Packing List Generation Confirmation',
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
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Generate Packing Lists',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#7950f2',
        cancelButtonColor: '#868e96',
        width: '600px',
        allowOutsideClick: false,
        customClass: {
          popup: 'swal-wide',
          confirmButton: 'swal-confirm-btn',
          cancelButton: 'swal-cancel-btn',
        },
      });

      if (!result.isConfirmed) {
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

          link.download = buildPackingListFilename({
            customerNames: filteredEligible.map(
              (transaction) => transaction.Customers
            ),
          });

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

          const dispatchCustomerNames: Set<string> = new Set();
          const normalizedDispatchCustomerNames: Set<string> = new Set();

          const normalizeName = (value: string | null | undefined) =>
            (value || '')
              .replace(/\s*\|\s*/g, ' | ')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();

          const collectNameVariants = (
            customerName: string | null | undefined,
            businessName: string | null | undefined
          ) => {
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
              dispatchCustomerNames.add(variant);
              const normalized = normalizeName(variant);
              if (normalized) {
                normalizedDispatchCustomerNames.add(normalized);
              }
            });
          };
          try {
            const dispatchResponse = await fetch(
              buildApiPath(apiBasePath, '/dispatch/orders')
            );
            logger.info('Dispatch response status:', dispatchResponse.status);

            if (dispatchResponse.ok) {
              const dispatchData = (await dispatchResponse.json()) as {
                success: boolean;
                data: Array<{ 'Username (Buyer)'?: string | null }>;
              };

              logger.info('Dispatch data received:', {
                success: dispatchData.success,
                totalOrders: dispatchData.data.length,
              });

              const dispatchUsernames = Array.from(
                new Set(
                  dispatchData.data
                    .map((order) => order['Username (Buyer)'])
                    .filter((username): username is string => Boolean(username))
                )
              );

              logger.info('Dispatch usernames:', {
                count: dispatchUsernames.length,
                usernames: dispatchUsernames,
              });

              if (dispatchUsernames.length > 0) {
                const customersResponse = await fetch(
                  buildApiPath(apiBasePath, '/customers/with-shopee')
                );
                logger.info(
                  'Customers with Shopee response status:',
                  customersResponse.status
                );

                if (customersResponse.ok) {
                  type CustomerRecord = {
                    id: number;
                    customerName: string;
                    businessName: string;
                    shopeeUsernames: string[];
                  };

                  const customersData = (await customersResponse.json()) as {
                    success: boolean;
                    data: CustomerRecord[] | { customers: CustomerRecord[] };
                  };

                  const customersPayload = Array.isArray(customersData.data)
                    ? customersData.data
                    : customersData.data.customers;

                  logger.info('Customers with Shopee data received:', {
                    success: customersData.success,
                    totalCustomers: customersPayload.length,
                  });

                  dispatchUsernames.forEach((username) => {
                    const normalizedUsername = username.toLowerCase().trim();
                    const matchedCustomer = customersPayload.find((customer) =>
                      customer.shopeeUsernames
                        .map((value) => value.toLowerCase().trim())
                        .includes(normalizedUsername)
                    );

                    if (matchedCustomer) {
                      collectNameVariants(
                        matchedCustomer.customerName,
                        matchedCustomer.businessName
                      );
                    }
                  });

                  logger.info('✅ Dispatch customer names matched:', {
                    count: dispatchCustomerNames.size,
                    names: Array.from(dispatchCustomerNames),
                  });
                } else {
                  logger.error(
                    'Failed to fetch customers with Shopee:',
                    customersResponse.statusText
                  );
                }
              } else {
                logger.warn('No usernames found in dispatch orders');
              }
            } else {
              logger.error(
                'Failed to fetch dispatch orders:',
                dispatchResponse.statusText
              );
            }
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

              const transactionNameVariants = new Set<string>();
              if (customerName) {
                transactionNameVariants.add(customerName);
                const [primary, secondary] = customerName
                  .split('|')
                  .map((part) => part.trim());
                if (primary) {
                  transactionNameVariants.add(primary);
                }
                if (secondary) {
                  transactionNameVariants.add(secondary);
                }
              }

              const isInDispatch = Array.from(transactionNameVariants).some(
                (nameVariant) =>
                  normalizedDispatchCustomerNames.has(
                    normalizeName(nameVariant)
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
