'use client';

import { useCallback } from 'react';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import type { RawOrderData } from '../types';

interface UseDispatchActionsParams {
  effectiveRawData: RawOrderData[];
  lookupCustomerName: (username: string) => string;
  updateOrderCompletion: (orderId: string, completed: boolean) => void;
}

export function useDispatchActions({
  effectiveRawData,
  lookupCustomerName,
  updateOrderCompletion,
}: UseDispatchActionsParams) {
  // Handler for clicking customer name - copy and open Facebook
  const handleCustomerNameClick = useCallback(
    async (
      item: { id: string; customerNames: string; username: string },
      facebookLink: string | undefined
    ) => {
      if (!facebookLink) {
        showNotification({
          title: 'No Facebook Link',
          message: 'No Facebook profile found for this customer yet.',
          color: 'yellow',
        });
        return;
      }

      const normalizedLink = facebookLink.startsWith('http')
        ? facebookLink
        : `https://${facebookLink}`;

      window.open(normalizedLink, '_blank', 'noopener,noreferrer');
      updateOrderCompletion(item.id, true);
    },
    [updateOrderCompletion]
  );

  // Navigate to possible match tab
  const navigateToPossibleMatchTab = useCallback(
    (setActiveTab: (tab: string | null) => void) => {
      setActiveTab('possible-match');
      window.setTimeout(() => {
        const tabElement = document.getElementById(
          'dispatch-possible-match-tab'
        );
        if (tabElement instanceof HTMLElement) {
          tabElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          tabElement.focus();
        }
      }, 0);
    },
    []
  );

  // Update shipped orders handler
  const handleUpdateShippedOrders = useCallback(async () => {
    try {
      // Calculate 24 hours ago
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Filter orders shipped within the last 24 hours
      const recentOrders = effectiveRawData.filter((row) => {
        const rawShipTime = row['Ship Time'];
        if (!rawShipTime) {
          return false;
        }

        const shipDate = new Date(String(rawShipTime));
        if (isNaN(shipDate.getTime())) {
          return false;
        }

        return shipDate >= twentyFourHoursAgo;
      });

      if (recentOrders.length === 0) {
        await Swal.fire({
          title: 'No Recent Orders',
          text: 'No orders have been shipped in the last 24 hours.',
          icon: 'info',
          confirmButtonColor: '#3085d6',
        });
        return;
      }

      // Get customer names for these orders
      const customerNames = recentOrders
        .map((row) => {
          const username = row['Username (Buyer)'] || '';
          return lookupCustomerName(username);
        })
        .filter((name) => name); // Remove empty names

      const uniqueCustomerNames = Array.from(new Set(customerNames));

      if (uniqueCustomerNames.length === 0) {
        await Swal.fire({
          title: 'No Matched Customers',
          text: 'None of the recent orders have matched customers in the system.',
          icon: 'warning',
          confirmButtonColor: '#3085d6',
        });
        return;
      }

      // Fetch all transactions
      const transactions = (await apiClient.get('/api/transactions')) as Array<{
        id: number;
        Customers: string;
        'Order Status': string | null;
        'Product Code': string;
        Quantity: number;
      }>;

      // Filter transactions: exact customer name match AND status is "Checked Out" or "Ready For Dispatch"
      const matchingTransactions = transactions.filter((transaction) => {
        const isCustomerMatch = uniqueCustomerNames.includes(
          transaction.Customers
        );
        const isStatusMatch =
          transaction['Order Status'] === 'Checked Out' ||
          transaction['Order Status'] === 'Ready For Dispatch';
        return isCustomerMatch && isStatusMatch;
      });

      if (matchingTransactions.length === 0) {
        await Swal.fire({
          title: 'No Transactions Found',
          text: 'No transactions with "Checked Out" or "Ready For Dispatch" status found for these customers.',
          icon: 'info',
          confirmButtonColor: '#3085d6',
        });
        return;
      }

      // Group transactions by customer
      const groupedByCustomer = matchingTransactions.reduce(
        (acc, t) => {
          const customer = t.Customers;
          if (!acc[customer]) {
            acc[customer] = [];
          }
          acc[customer].push(t);
          return acc;
        },
        {} as Record<string, typeof matchingTransactions>
      );

      const transactionList = Object.entries(groupedByCustomer)
        .map(([customer, transactions]) => {
          const productsList = transactions
            .map(
              (t) =>
                `<div style="padding: 8px 12px; margin: 4px 0; background: rgba(255, 255, 255, 0.6); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 13px; color: #2d3748;">${t['Product Code']}</span>
                  <span style="background: rgba(102, 126, 234, 0.15); padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; color: #5a67d8;">
                    ${t['Order Status']}
                  </span>
                </div>`
            )
            .join('');

          return `<div style="padding: 14px; margin: 10px 0; background: linear-gradient(135deg, #a8b5ff 0%, #b8a3d9 100%); border-radius: 10px; box-shadow: 0 2px 8px rgba(168, 181, 255, 0.3);">
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 10px; color: #2d3748;">${customer}</div>
            <div>${productsList}</div>
          </div>`;
        })
        .join('');

      // First confirmation
      const firstConfirm = await Swal.fire({
        title: 'Update Orders to Shipped?',
        html: `
          <div style="text-align: left; padding: 10px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
              <div style="font-size: 16px; font-weight: 600;">Found ${matchingTransactions.length} transaction(s) from ${Object.keys(groupedByCustomer).length} customer(s) to update</div>
              <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Review the orders below before proceeding</div>
            </div>
            <div style="max-height: 450px; overflow-y: auto; padding: 0 4px;">
              ${transactionList}
            </div>
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 16px 20px; border-radius: 12px; margin-top: 20px; text-align: center; box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);">
              <div style="font-weight: 600; font-size: 15px;">These orders will be updated to "Shipped" status</div>
            </div>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#adb5bd',
        confirmButtonText: 'Continue',
        cancelButtonText: 'Cancel',
        width: '800px',
        customClass: {
          popup: 'swal-wide-popup',
          htmlContainer: 'swal-html-container',
        },
      });

      if (!firstConfirm.isConfirmed) {
        return;
      }

      // Second confirmation
      const secondConfirm = await Swal.fire({
        title: 'Are you sure?',
        html: `
          <p>This will update <strong>${matchingTransactions.length} transaction(s)</strong> to <strong>"Shipped"</strong> status.</p>
          <p style="color: #ff6b6b; margin-top: 10px;">This action cannot be undone easily.</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#adb5bd',
        confirmButtonText: 'Yes, update them!',
        cancelButtonText: 'Cancel',
      });

      if (!secondConfirm.isConfirmed) {
        return;
      }

      // Update all matching transactions
      let successCount = 0;
      let failCount = 0;

      for (const transaction of matchingTransactions) {
        try {
          await apiClient.patch('/api/transactions', {
            id: transaction.id,
            'Order Status': 'Shipped',
          });
          successCount++;
        } catch (error) {
          logger.error(`Failed to update transaction ${transaction.id}`, error);
          failCount++;
        }
      }

      // Show success notification
      await Swal.fire({
        title: 'Update Complete!',
        html: `
          <div style="text-align: left;">
            <p><strong>Successfully updated:</strong> ${successCount} transaction(s)</p>
            ${failCount > 0 ? `<p style="color: #ff6b6b;"><strong>Failed:</strong> ${failCount} transaction(s)</p>` : ''}
          </div>
        `,
        icon: successCount > 0 ? 'success' : 'error',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK',
      });

      showNotification({
        title: 'Orders Updated',
        message: `${successCount} transaction(s) updated to "Shipped" status`,
        color: 'green',
      });
    } catch (error) {
      logger.error('Failed to update shipped orders', error);
      await Swal.fire({
        title: 'Error',
        text: 'Failed to update orders. Please try again.',
        icon: 'error',
        confirmButtonColor: '#d33',
      });
    }
  }, [effectiveRawData, lookupCustomerName]);

  // Link customer handler
  const handleLinkCustomer = useCallback(
    async (
      orderId: string,
      customerId: number,
      customerName: string,
      username: string,
      deliveryAddress: string,
      addressScore: number,
      linkCustomerMutation: {
        mutate: (data: {
          customerId: number;
          username: string;
          deliveryAddress: string;
          addressScore: number;
        }) => void;
      }
    ) => {
      const result = await Swal.fire({
        title: 'Link Customer?',
        html: `
          <div style="text-align: left; margin-top: 15px;">
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Shopee Username:</strong> ${username}</p>
            <p><strong>Match Score:</strong> ${addressScore.toFixed(1)}%</p>
            ${
              addressScore <= 80
                ? `<p style="color: #ff6b6b;"><strong>Note:</strong> Address will be saved (match ≤80%)</p>`
                : ''
            }
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#adb5bd',
        confirmButtonText: 'Yes, link customer',
        cancelButtonText: 'Cancel',
        allowOutsideClick: false,
      });

      if (result.isConfirmed) {
        linkCustomerMutation.mutate({
          customerId,
          username,
          deliveryAddress,
          addressScore,
        });
      }
    },
    []
  );

  return {
    handleCustomerNameClick,
    navigateToPossibleMatchTab,
    handleUpdateShippedOrders,
    handleLinkCustomer,
  };
}
