'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { apiClient } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import { parseLineTotal } from '@/lib/transactions';
import { runMicroBenchmark } from '@/lib/performance/benchmarks';
import type { DispatchItem, RawOrderData } from '../types';

interface UseDispatchDataParams {
  _serverCustomersData?: Array<{
    id: number;
    customerName: string;
    businessName: string;
    facebook: string;
    shopeeUsernames: string[];
    address: string;
    phoneNumber: string;
    additionalAddresses: string[];
  }>;
  lookupCustomerName: (username: string) => string;
  apiBasePath?: string;
}

interface UseDispatchDataResult {
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  rawData: RawOrderData[];
  setRawData: (data: RawOrderData[]) => void;
  statusFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  dateRangeFilter: string | null;
  setDateRangeFilter: (filter: string | null) => void;
  completedOrders: Record<string, boolean>;
  updateOrderCompletion: (orderId: string, completed: boolean) => void;
  actionLinksEnabled: boolean;
  toggleActionLinks: () => void;
  hoveredCustomerId: string | null;
  setHoveredCustomerId: (id: string | null) => void;
  savedOrders: RawOrderData[] | undefined;
  loadingSavedOrders: boolean;
  fetchError: Error | null;
  effectiveRawData: RawOrderData[];
  saveOrdersMutation: UseMutationResult<
    {
      success: boolean;
      message: string;
      data: { deleted: number; created: number };
    },
    Error,
    RawOrderData[]
  >;
  linkCustomerMutation: UseMutationResult<
    {
      customerId: number;
      username: string;
      addressAdded: boolean;
      usernameAlreadyExists: boolean;
      addressAlreadyExists: boolean;
    },
    Error,
    {
      customerId: number;
      username: string;
      deliveryAddress: string;
      addressScore: number;
    }
  >;
  filteredData: DispatchItem[];
  unmatchedOrders: Array<{
    orderId: string;
    username: string;
    deliveryAddress: string;
    receiverName: string;
    phoneNumber: string;
    city: string;
    province: string;
    zipCode: string;
  }>;
  autoCompletedOrders: Record<string, boolean>;
  preparedLineTotalsByCustomer: Record<string, number>;
}

type TransactionRecord = {
  id: number;
  Customers?: string | null;
  'Order Status'?: string | null;
  'Line Total'?: number | string | null;
};

const AUTO_HANDLED_TRANSACTION_STATUSES = new Set([
  'ready for dispatch',
  'checked out',
  'pending payment',
]);

export function useDispatchData({
  _serverCustomersData,
  lookupCustomerName,
  apiBasePath,
}: UseDispatchDataParams): UseDispatchDataResult {
  const [activeTab, setActiveTab] = useState<string | null>('match');
  const [searchQuery, setSearchQuery] = useState('');
  const [rawData, setRawData] = useState<RawOrderData[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<string | null>(null);
  const [completedOrders, setCompletedOrders] = useState<
    Record<string, boolean>
  >({});
  const [actionLinksEnabled, setActionLinksEnabled] = useState(true);
  const [hoveredCustomerId, setHoveredCustomerId] = useState<string | null>(
    null
  );

  const queryClient = useQueryClient();
  const queryScope = apiBasePath ?? 'default';
  const dispatchOrdersQueryKey = queryKeys.dispatch.orders.list(queryScope);
  const dispatchTransactionsQueryKey =
    queryKeys.dispatch.transactions.list(queryScope);
  const possibleMatchesQueryKey =
    queryKeys.dispatch.possibleMatches.list(queryScope);

  // Fetch saved dispatch orders from database
  const {
    data: savedOrders,
    isLoading: loadingSavedOrders,
    error: fetchError,
  } = useQuery({
    queryKey: dispatchOrdersQueryKey,
    queryFn: async () => {
      const response = (await apiClient.get(
        buildApiPath(apiBasePath, '/dispatch/orders')
      )) as {
        success: boolean;
        data: RawOrderData[];
        count: number;
      };
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const { data: transactions = [] } = useQuery<TransactionRecord[]>({
    queryKey: dispatchTransactionsQueryKey,
    queryFn: async () =>
      (await apiClient.get(
        buildApiPath(apiBasePath, '/transactions')
      )) as TransactionRecord[],
    staleTime: 60 * 1000,
  });

  const preparedLineTotalsByCustomer = useMemo(
    () =>
      runMicroBenchmark(
        'useDispatchData.preparedLineTotalsByCustomer',
        () => {
          if (transactions.length === 0) {
            return {};
          }

          return transactions.reduce(
            (acc, transaction) => {
              const status = normalizeOrderStatus(transaction['Order Status']);
              if (status !== 'prepared') {
                return acc;
              }

              const customerName = transaction.Customers?.trim();
              if (!customerName) {
                return acc;
              }

              const numericValue = parseLineTotal(transaction['Line Total']);

              acc[customerName] = (acc[customerName] ?? 0) + numericValue;
              return acc;
            },
            {} as Record<string, number>
          );
        },
        { metadata: { transactions: transactions.length } }
      ),
    [transactions]
  );

  const handledTransactionCustomers = useMemo(() => {
    if (transactions.length === 0) {
      return {};
    }

    return transactions.reduce(
      (acc, transaction) => {
        const customerName = transaction.Customers?.trim();
        if (!customerName) {
          return acc;
        }

        const status = normalizeOrderStatus(transaction['Order Status']);
        if (AUTO_HANDLED_TRANSACTION_STATUSES.has(status)) {
          acc[customerName] = true;
        }

        return acc;
      },
      {} as Record<string, boolean>
    );
  }, [transactions]);

  // Mutation to save orders to database
  const saveOrdersMutation = useMutation<
    {
      success: boolean;
      message: string;
      data: { deleted: number; created: number };
    },
    Error,
    RawOrderData[]
  >({
    mutationFn: async (orders: RawOrderData[]) => {
      const response = (await apiClient.post(
        buildApiPath(apiBasePath, '/dispatch/orders'),
        {
          orders,
        },
        { unwrapApiResponse: false }
      )) as {
        success: boolean;
        message: string;
        data: { deleted: number; created: number };
      };
      return response;
    },
    onSuccess: (response) => {
      logger.info('Orders saved to database', response.data);
      queryClient.invalidateQueries({ queryKey: dispatchOrdersQueryKey });
      showNotification({
        title: 'Success',
        message: `${response.data.created} orders saved to database (replaced ${response.data.deleted} previous orders)`,
        color: 'green',
      });
    },
    onError: (error) => {
      logger.error('Failed to save orders to database', error);
      showNotification({
        title: 'Error',
        message: 'Failed to save orders to database. Please try again.',
        color: 'red',
      });
    },
  });

  // Mutation to link customer (add Shopee username and optionally address)
  const linkCustomerMutation = useMutation<
    {
      customerId: number;
      username: string;
      addressAdded: boolean;
      usernameAlreadyExists: boolean;
      addressAlreadyExists: boolean;
    },
    Error,
    {
      customerId: number;
      username: string;
      deliveryAddress: string;
      addressScore: number;
    }
  >({
    mutationFn: async ({
      customerId,
      username,
      deliveryAddress,
      addressScore,
    }: {
      customerId: number;
      username: string;
      deliveryAddress: string;
      addressScore: number;
    }) => {
      // Add Shopee username
      const usernameResponse = (await apiClient.post(
        buildApiPath(
          apiBasePath,
          `/customers/${customerId}/additional-info/add`
        ),
        {
          type: 'shopee_username',
          value: username.toLowerCase().trim(),
        }
      )) as { alreadyExists: boolean; message: string };

      let addressResponse: { alreadyExists: boolean; message: string } | null =
        null;
      // If address match is 80% or below, also add the delivery address
      if (addressScore <= 80) {
        addressResponse = (await apiClient.post(
          buildApiPath(
            apiBasePath,
            `/customers/${customerId}/additional-info/add`
          ),
          {
            type: 'address',
            value: deliveryAddress,
          }
        )) as { alreadyExists: boolean; message: string };
      }

      return {
        customerId,
        username,
        addressAdded: addressScore <= 80,
        usernameAlreadyExists: usernameResponse.alreadyExists || false,
        addressAlreadyExists: addressResponse?.alreadyExists || false,
      };
    },
    onSuccess: (data) => {
      logger.info('Customer linked successfully', data);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.withShopee(),
      });
      queryClient.invalidateQueries({ queryKey: possibleMatchesQueryKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dispatch.orders.all(),
      });

      showNotification({
        title: 'Customer Linked',
        message: data.addressAdded
          ? `Shopee username and delivery address added successfully!`
          : `Shopee username added successfully!`,
        color: 'green',
      });
    },
    onError: (error) => {
      logger.error('Failed to link customer', error);
      showNotification({
        title: 'Error',
        message: 'Failed to link customer. Please try again.',
        color: 'red',
      });
    },
  });

  // Use saved orders if available, otherwise use rawData
  const effectiveRawData =
    savedOrders && savedOrders.length > 0 ? savedOrders : rawData;

  // Get unmatched orders for possible match tab
  const unmatchedOrders = useMemo(() => {
    return effectiveRawData
      .filter((row) => {
        const username = row['Username (Buyer)'] || '';
        const matchedCustomer = lookupCustomerName(username);
        return !matchedCustomer; // No match found
      })
      .map((row) => ({
        orderId: String(row['Order ID'] || ''),
        username: String(row['Username (Buyer)'] || ''),
        deliveryAddress: String(row['Delivery Address'] || ''),
        receiverName: String(row['Receiver Name'] || ''),
        phoneNumber: String(row['Phone Number'] || ''),
        city: String(row['City'] || ''),
        province: String(row['Province'] || ''),
        zipCode: String(row['Zip Code'] || ''),
      }));
  }, [effectiveRawData, lookupCustomerName]);

  // Helper function to extract carrier name from shipping option
  const extractCarrierName = useCallback((shippingOption: string): string => {
    if (!shippingOption) {
      return '';
    }

    // Extract carrier name from format like "Standard Local-J&T Express"
    const match = shippingOption.match(/-([\w&]+)/);
    if (match && match[1]) {
      return match[1]; // Returns "J&T", "LBC", etc.
    }

    // If no match, return the original
    return shippingOption;
  }, []);

  // Search filtering and data transformation
  const filteredData = useMemo(() => {
    // Transform raw data from database or XLSX import to DispatchItem format
    const dataSource: DispatchItem[] = effectiveRawData.map((row, index) => {
      const username = row['Username (Buyer)'] || '';
      const matchedCustomer = lookupCustomerName(username);
      const orderId = row['Order ID'] || `imported-${index}`;

      // If no direct match, check for possible matches
      return {
        id: orderId,
        orderStatus: row['Order Status'] || '',
        shippingOptions: extractCarrierName(row['Shipping Option'] || ''),
        username,
        customerNames: matchedCustomer || '',
        messageCustomer: row['Remark from buyer'] || '',
      };
    });

    // Apply status filter for Dashboard tab - exclude Shipping and Delivered
    let filtered = dataSource;
    if (activeTab === 'match') {
      filtered = dataSource.filter(
        (item) =>
          item.orderStatus !== 'Shipping' && item.orderStatus !== 'Delivered'
      );
    }

    // Apply base filter for checkout-update tab - exclude To Ship (case-insensitive)
    if (activeTab === 'checkout-update') {
      filtered = dataSource.filter(
        (item) => item.orderStatus.toLowerCase() !== 'to ship'
      );
    }

    // Apply status filter for checkout-update tab
    if (activeTab === 'checkout-update' && statusFilter) {
      filtered = filtered.filter((item) => item.orderStatus === statusFilter);
    }

    // Apply date range filter for checkout-update tab
    if (activeTab === 'checkout-update' && dateRangeFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((item) => {
        const rawOrder = effectiveRawData.find(
          (row) => String(row['Order ID'] || '') === item.id
        );
        const rawShipTime = rawOrder?.['Ship Time'];

        if (!rawShipTime) {
          return false;
        }

        const shipDate = new Date(String(rawShipTime));
        if (isNaN(shipDate.getTime())) {
          return false;
        }

        switch (dateRangeFilter) {
          case 'today': {
            const shipDay = new Date(
              shipDate.getFullYear(),
              shipDate.getMonth(),
              shipDate.getDate()
            );
            return shipDay.getTime() === today.getTime();
          }
          case 'yesterday': {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const shipDay = new Date(
              shipDate.getFullYear(),
              shipDate.getMonth(),
              shipDate.getDate()
            );
            return shipDay.getTime() === yesterday.getTime();
          }
          case 'last7days': {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return shipDate >= sevenDaysAgo;
          }
          case 'last30days': {
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return shipDate >= thirtyDaysAgo;
          }
          case 'thisMonth': {
            return (
              shipDate.getMonth() === now.getMonth() &&
              shipDate.getFullYear() === now.getFullYear()
            );
          }
          case 'lastMonth': {
            const lastMonth = new Date(
              now.getFullYear(),
              now.getMonth() - 1,
              1
            );
            return (
              shipDate.getMonth() === lastMonth.getMonth() &&
              shipDate.getFullYear() === lastMonth.getFullYear()
            );
          }
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (!searchQuery.trim()) {
      // Sort by Ship Time descending for Recently Updated Orders tab
      if (activeTab === 'recently-updated') {
        return filtered.sort((a, b) => {
          const aOrder = effectiveRawData.find(
            (row) => String(row['Order ID'] || '') === a.id
          );
          const bOrder = effectiveRawData.find(
            (row) => String(row['Order ID'] || '') === b.id
          );

          const aTime = aOrder?.['Ship Time'];
          const bTime = bOrder?.['Ship Time'];

          if (!aTime || !bTime) {
            return 0;
          }

          const aDate = new Date(String(aTime));
          const bDate = new Date(String(bTime));

          if (isNaN(aDate.getTime()) || isNaN(bDate.getTime())) {
            return 0;
          }

          // Descending order (newest first)
          return bDate.getTime() - aDate.getTime();
        });
      }
      return filtered;
    }

    const query = searchQuery.toLowerCase();
    const searchFiltered = filtered.filter((item) => {
      return (
        item.orderStatus.toLowerCase().includes(query) ||
        item.shippingOptions.toLowerCase().includes(query) ||
        item.username.toLowerCase().includes(query) ||
        item.customerNames.toLowerCase().includes(query) ||
        item.messageCustomer.toLowerCase().includes(query)
      );
    });

    // Sort by Ship Time descending for Recently Updated Orders tab even after search
    if (activeTab === 'recently-updated') {
      return searchFiltered.sort((a, b) => {
        const aOrder = effectiveRawData.find(
          (row) => String(row['Order ID'] || '') === a.id
        );
        const bOrder = effectiveRawData.find(
          (row) => String(row['Order ID'] || '') === b.id
        );

        const aTime = aOrder?.['Ship Time'];
        const bTime = bOrder?.['Ship Time'];

        if (!aTime || !bTime) {
          return 0;
        }

        const aDate = new Date(String(aTime));
        const bDate = new Date(String(bTime));

        if (isNaN(aDate.getTime()) || isNaN(bDate.getTime())) {
          return 0;
        }

        // Descending order (newest first)
        return bDate.getTime() - aDate.getTime();
      });
    }

    return searchFiltered;
  }, [
    effectiveRawData,
    lookupCustomerName,
    activeTab,
    statusFilter,
    dateRangeFilter,
    searchQuery,
    extractCarrierName,
  ]);

  // Automatically mark orders as handled from transaction status or small prepared totals
  const autoCompletedOrders = useMemo(() => {
    if (filteredData.length === 0) {
      return {};
    }

    return filteredData.reduce(
      (acc, item) => {
        const customerKey = item.customerNames?.trim();
        if (!customerKey) {
          return acc;
        }

        if (handledTransactionCustomers[customerKey]) {
          acc[item.id] = true;
          return acc;
        }

        const total = preparedLineTotalsByCustomer[customerKey];
        if (typeof total === 'number' && total <= 50) {
          acc[item.id] = true;
        }
        return acc;
      },
      {} as Record<string, boolean>
    );
  }, [filteredData, handledTransactionCustomers, preparedLineTotalsByCustomer]);

  const updateOrderCompletion = useCallback(
    (orderId: string, completed: boolean) => {
      setCompletedOrders((prev) => ({
        ...prev,
        [orderId]: completed,
      }));
    },
    []
  );

  const toggleActionLinks = useCallback(() => {
    setActionLinksEnabled((prev) => !prev);
  }, []);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    rawData,
    setRawData,
    statusFilter,
    setStatusFilter,
    dateRangeFilter,
    setDateRangeFilter,
    completedOrders,
    updateOrderCompletion,
    actionLinksEnabled,
    toggleActionLinks,
    hoveredCustomerId,
    setHoveredCustomerId,
    savedOrders,
    loadingSavedOrders,
    fetchError,
    effectiveRawData,
    saveOrdersMutation,
    linkCustomerMutation,
    filteredData,
    unmatchedOrders,
    autoCompletedOrders,
    preparedLineTotalsByCustomer,
  };
}
