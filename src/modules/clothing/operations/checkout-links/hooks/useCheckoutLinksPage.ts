import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';
import { getCurrentDateISO } from '@/utils/date';
import { useInvoiceCustomerLookup } from './useInvoiceCustomerLookup';
import {
  fetchCheckoutLinksData,
  fetchCustomerOrders,
  fetchProductsData,
} from './checkoutLinksApi';
import {
  buildCustomerOrderWeightsByCustomer,
  buildLocalInvoiceData,
  buildLocalInvoiceDateOptions,
} from './checkoutLinksDerivedData';
import {
  filterCheckoutLinks,
  filterCustomerOrders,
  filterItemWeightData,
  filterLocalInvoiceData,
} from './checkoutLinksFilters';
import { calculateFinalWeight } from '../utils/finalWeightCalculator';
import { findCheckoutLinkByWeight } from '../utils/checkoutLinkMatcher';
import { generateInvoiceMessage } from '../utils/messageGenerator';
import { copyTextToClipboard } from '../lib/clipboard';
import { hasWeightData, mapProductToItemWeight } from '../lib/weights';
import type {
  CheckoutLinkData,
  CheckoutLinkFormValues,
  CustomerOrderData,
  InvoiceData,
  ItemWeightData,
} from '../types';
import type { TransactionData } from '../../transactions/types/transaction.types';

interface InvoiceSettingsResponse {
  messageTemplate: string;
  paymentChannelsUrl: string;
}

const CUSTOMER_ORDER_ELIGIBLE_STATUSES: string[] = [
  'prepared',
  'on-hold',
  'ready for dispatch',
];

type CheckoutLinksApiConfig = {
  apiBasePath?: string;
  checkoutLinksApiBasePath?: string;
};

export const useCheckoutLinksPage = ({
  apiBasePath,
  checkoutLinksApiBasePath,
}: CheckoutLinksApiConfig = {}) => {
  const [activeTab, setActiveTab] = useState<string | null>('invoicing');
  const [localInvoicingSearchQuery, setLocalInvoicingSearchQuery] =
    useState('');
  const [customerOrdersSearchQuery, setCustomerOrdersSearchQuery] =
    useState('');
  const [itemWeightSearchQuery, setItemWeightSearchQuery] = useState('');
  const [checkoutLinksSearchQuery, setCheckoutLinksSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLinks, setCheckoutLinks] = useState<CheckoutLinkData[]>([]);
  const [localInvoiceDateFilter, setLocalInvoiceDateFilter] = useState<
    string | null
  >(null);
  const [localInvoiceTickboxes, setLocalInvoiceTickboxes] = useState<
    Record<string, boolean>
  >({});
  const [transactionsWithInvoiceDate, setTransactionsWithInvoiceDate] =
    useState<TransactionData[]>([]);
  const [itemWeightData, setItemWeightData] = useState<ItemWeightData[]>([]);
  const [isItemWeightLoading, setIsItemWeightLoading] = useState(true);
  const [itemWeightError, setItemWeightError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCheckoutLink, setEditingCheckoutLink] =
    useState<CheckoutLinkData | null>(null);
  const [isSavingCheckoutLink, setIsSavingCheckoutLink] = useState(false);

  const { lookupFacebookLink, hasFacebookLink } = useInvoiceCustomerLookup(
    true,
    apiBasePath
  );
  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );
  const resolveCheckoutLinksApiPath = useCallback(
    (path: string) =>
      buildApiPath(checkoutLinksApiBasePath ?? apiBasePath, path),
    [checkoutLinksApiBasePath, apiBasePath]
  );
  const queryScope = apiBasePath ?? 'default';
  const invoiceSettingsQueryKey = useMemo(
    () => queryKeys.checkoutLinks.invoiceSettings(queryScope),
    [queryScope]
  );
  const customerOrdersQueryKey = useMemo(
    () => queryKeys.checkoutLinks.customerOrders(queryScope),
    [queryScope]
  );

  const { data: invoiceSettings } = useQuery<InvoiceSettingsResponse>({
    queryKey: invoiceSettingsQueryKey,
    queryFn: async () => {
      return api.get<InvoiceSettingsResponse>('/api/invoice-settings');
    },
    placeholderData: () => ({
      messageTemplate: '',
      paymentChannelsUrl: '',
    }),
    staleTime: 10 * 60 * 1000,
  });

  const checkoutLinkForm = useForm<CheckoutLinkFormValues>({
    initialValues: {
      weight: '',
      width: '',
      length: '',
      height: '',
      checkoutLinks: '',
      productPortals: '',
      productNames: '',
    },
    validate: {
      weight: (value) =>
        value.trim().length === 0 ? 'Weight is required' : null,
      width: (value) =>
        value.trim().length === 0 ? 'Width is required' : null,
      length: (value) =>
        value.trim().length === 0 ? 'Length is required' : null,
      height: (value) =>
        value.trim().length === 0 ? 'Height is required' : null,
    },
  });

  const { data: customerOrders = [], isFetching: isCustomerOrdersLoading } =
    useQuery<CustomerOrderData[]>({
      queryKey: customerOrdersQueryKey,
      queryFn: async () =>
        fetchCustomerOrders(resolveApiPath('/invoices/customer-orders')),
      refetchOnWindowFocus: true,
      refetchInterval: 60 * 1000,
      staleTime: 30 * 1000,
    });

  const loadCheckoutLinks = useCallback(async () => {
    try {
      const data = await fetchCheckoutLinksData(
        resolveCheckoutLinksApiPath('/checkout-links')
      );
      setCheckoutLinks(data);
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load checkout links',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, [resolveCheckoutLinksApiPath]);

  const loadProductWeights = useCallback(async () => {
    setIsItemWeightLoading(true);
    setItemWeightError(null);

    try {
      const products = await fetchProductsData(resolveApiPath('/products'));

      const productsWithWeight = products.filter(hasWeightData);

      setItemWeightData(productsWithWeight.map(mapProductToItemWeight));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load product weights';
      setItemWeightError(message);
      setItemWeightData([]);
      showNotification({
        title: 'Error',
        message,
        color: 'red',
      });
    } finally {
      setIsItemWeightLoading(false);
    }
  }, [resolveApiPath]);

  const loadTransactionsWithInvoiceDate = useCallback(async () => {
    try {
      const response = await fetch(resolveApiPath('/transactions'));

      if (!response.ok) {
        throw new Error('Failed to load transactions');
      }

      const payload = (await response.json()) as
        | TransactionData[]
        | { data?: TransactionData[] }
        | undefined;

      let transactions: TransactionData[] = [];

      if (Array.isArray(payload)) {
        transactions = payload;
      } else if (payload && Array.isArray(payload.data)) {
        transactions = payload.data;
      }

      const withInvoiceDates = transactions.filter((transaction) => {
        const hasInvoiceDate = Boolean(transaction['Invoice Date']?.trim());
        const orderStatus = transaction['Order Status']?.trim().toLowerCase();
        const isEligibleStatus = orderStatus
          ? CUSTOMER_ORDER_ELIGIBLE_STATUSES.includes(orderStatus)
          : false;
        return hasInvoiceDate && isEligibleStatus;
      });

      setTransactionsWithInvoiceDate(withInvoiceDates);
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load transactions for invoicing',
        color: 'red',
      });
    }
  }, [resolveApiPath]);

  useEffect(() => {
    void loadCheckoutLinks();
  }, [loadCheckoutLinks]);

  useEffect(() => {
    void loadProductWeights();
  }, [loadProductWeights]);

  useEffect(() => {
    void loadTransactionsWithInvoiceDate();
  }, [loadTransactionsWithInvoiceDate]);

  const filteredCheckoutLinks = useMemo(() => {
    return filterCheckoutLinks(checkoutLinks, checkoutLinksSearchQuery);
  }, [checkoutLinks, checkoutLinksSearchQuery]);

  const customerOrderWeightsByCustomer = useMemo(() => {
    return buildCustomerOrderWeightsByCustomer(customerOrders);
  }, [customerOrders]);

  const localInvoiceData = useMemo<InvoiceData[]>(() => {
    return buildLocalInvoiceData({
      transactionsWithInvoiceDate,
      localInvoiceTickboxes,
      customerOrderWeightsByCustomer,
    });
  }, [
    transactionsWithInvoiceDate,
    localInvoiceTickboxes,
    customerOrderWeightsByCustomer,
  ]);

  const filteredLocalInvoiceData = useMemo(() => {
    return filterLocalInvoiceData(
      localInvoiceData,
      localInvoicingSearchQuery,
      localInvoiceDateFilter
    );
  }, [localInvoiceData, localInvoicingSearchQuery, localInvoiceDateFilter]);

  const localInvoiceDateOptions = useMemo(() => {
    return buildLocalInvoiceDateOptions(transactionsWithInvoiceDate);
  }, [transactionsWithInvoiceDate]);

  useEffect(() => {
    setLocalInvoiceDateFilter((currentFilter) => {
      const latestInvoiceDate = localInvoiceDateOptions[0] ?? null;

      if (!latestInvoiceDate) {
        return null;
      }

      if (currentFilter && localInvoiceDateOptions.includes(currentFilter)) {
        return currentFilter;
      }

      return latestInvoiceDate;
    });
  }, [localInvoiceDateOptions]);

  const filteredItemWeightData = useMemo(() => {
    return filterItemWeightData(itemWeightData, itemWeightSearchQuery);
  }, [itemWeightData, itemWeightSearchQuery]);

  const filteredCustomerOrders = useMemo(() => {
    return filterCustomerOrders(customerOrders, customerOrdersSearchQuery);
  }, [customerOrders, customerOrdersSearchQuery]);

  const handleLocalInvoicingSearch = useCallback((query: string) => {
    setLocalInvoicingSearchQuery(query);
  }, []);

  const handleCustomerOrdersSearch = useCallback((query: string) => {
    setCustomerOrdersSearchQuery(query);
  }, []);

  const handleItemWeightSearch = useCallback((query: string) => {
    setItemWeightSearchQuery(query);
  }, []);

  const handleCheckoutLinksSearch = useCallback((query: string) => {
    setCheckoutLinksSearchQuery(query);
  }, []);

  const handleEdit = useCallback(
    (item: CheckoutLinkData) => {
      setEditingCheckoutLink(item);
      checkoutLinkForm.setValues({
        weight: item.weight ?? '',
        width: item.width ?? '',
        length: item.length ?? '',
        height: item.height ?? '',
        checkoutLinks: item.checkoutLinks ?? '',
        productPortals: item.productPortals ?? '',
        productNames: item.productNames ?? '',
      });
      checkoutLinkForm.resetDirty();
      setIsEditModalOpen(true);
    },
    [checkoutLinkForm]
  );

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingCheckoutLink(null);
    checkoutLinkForm.reset();
  }, [checkoutLinkForm]);

  const handleDelete = useCallback(
    async (item: CheckoutLinkData): Promise<boolean> => {
      const Swal = await getSwal();
      const productName =
        item.productNames || item.weight || 'this checkout link';

      const firstConfirmation = await Swal.fire({
        title: 'Delete checkout link?',
        text: `Are you sure you want to delete ${productName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Continue',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d33',
        allowOutsideClick: false,
      });

      if (!firstConfirmation.isConfirmed) {
        return false;
      }

      const secondConfirmation = await Swal.fire({
        title: 'Confirm permanent deletion',
        html: 'Type <strong>DELETE</strong> to confirm this removal.',
        icon: 'error',
        input: 'text',
        inputPlaceholder: 'Type DELETE',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Delete permanently',
        cancelButtonText: 'Back',
        allowOutsideClick: false,
        inputValidator: (value) => {
          if (value.trim().toUpperCase() !== 'DELETE') {
            return 'Please type DELETE to confirm.';
          }
          return null;
        },
      });

      if (!secondConfirmation.isConfirmed) {
        return false;
      }

      setPendingDeleteId(item.id);
      let wasDeleted = false;

      try {
        const response = await fetch(
          `${resolveCheckoutLinksApiPath('/checkout-links')}?id=${encodeURIComponent(item.id)}`,
          { method: 'DELETE' }
        );
        const result: { success?: boolean; error?: string } = await response
          .json()
          .catch(() => ({}));

        if (!response.ok || result.success !== true) {
          throw new Error(result.error || 'Failed to delete checkout link');
        }

        setCheckoutLinks((prev) => prev.filter((link) => link.id !== item.id));

        showNotification({
          title: 'Checkout link removed',
          message: `${productName} was deleted successfully`,
          color: 'green',
        });
        wasDeleted = true;
      } catch (error) {
        showNotification({
          title: 'Deletion failed',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to delete checkout link',
          color: 'red',
        });
        wasDeleted = false;
      } finally {
        setPendingDeleteId(null);
      }

      return wasDeleted;
    },
    [resolveCheckoutLinksApiPath]
  );

  const handleUpdateCheckoutLink = useCallback(
    async (values: CheckoutLinkFormValues) => {
      if (!editingCheckoutLink) {
        return;
      }

      setIsSavingCheckoutLink(true);

      try {
        const payload = {
          id: editingCheckoutLink.id,
          weight: values.weight.trim(),
          width: values.width.trim(),
          length: values.length.trim(),
          height: values.height.trim(),
          checkoutLinks: values.checkoutLinks.trim() || null,
          productPortals: values.productPortals.trim() || null,
          productNames: values.productNames.trim() || null,
        };

        const response = await fetch(
          resolveCheckoutLinksApiPath('/checkout-links'),
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );

        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(
            result?.error || 'Failed to update checkout link. Please retry.'
          );
        }

        const updatedRecord = result.data as CheckoutLinkData;
        const normalizedRecord: CheckoutLinkData = {
          id: updatedRecord.id,
          weight: updatedRecord.weight ?? '',
          width: updatedRecord.width ?? '',
          length: updatedRecord.length ?? '',
          height: updatedRecord.height ?? '',
          checkoutLinks: updatedRecord.checkoutLinks ?? '',
          productPortals: updatedRecord.productPortals ?? '',
          productNames: updatedRecord.productNames ?? '',
        };
        setCheckoutLinks((prev) =>
          prev.map((item) =>
            item.id === normalizedRecord.id
              ? { ...item, ...normalizedRecord }
              : item
          )
        );

        showNotification({
          title: 'Checkout link updated',
          message: `${
            normalizedRecord.productNames || normalizedRecord.weight
          } saved successfully`,
          color: 'green',
        });

        closeEditModal();
      } catch (error) {
        showNotification({
          title: 'Update failed',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update checkout link',
          color: 'red',
        });
      } finally {
        setIsSavingCheckoutLink(false);
      }
    },
    [closeEditModal, editingCheckoutLink, resolveCheckoutLinksApiPath]
  );

  const handleImportCSV = useCallback(
    (file: File | null) => {
      if (!file) {
        return;
      }

      if (!file.name.endsWith('.csv')) {
        showNotification({
          title: 'Invalid File Type',
          message: 'Please upload a CSV file',
          color: 'red',
        });
        return;
      }

      setIsImporting(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter((line) => line.trim());

          if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
          }

          const headers = lines[0]
            .split(',')
            .map((h) => h.trim().toUpperCase());
          const expectedHeaders = [
            'WEIGHT',
            'WIDTH',
            'LENGTH',
            'HEIGHT',
            'CHECKOUT LINKS',
            'PRODUCT PORTALS',
            'PRODUCT NAMES',
          ];

          const hasValidHeaders = expectedHeaders.every((header) =>
            headers.includes(header)
          );

          if (!hasValidHeaders) {
            throw new Error(
              'Invalid CSV format. Expected headers: WEIGHT, WIDTH, LENGTH, HEIGHT, CHECKOUT LINKS, PRODUCT PORTALS, PRODUCT NAMES'
            );
          }

          const parsedData: CheckoutLinkData[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const values: string[] = [];
            let currentValue = '';
            let insideQuotes = false;

            for (let j = 0; j < line.length; j++) {
              const char = line[j];
              if (char === '"') {
                insideQuotes = !insideQuotes;
              } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
              } else {
                currentValue += char;
              }
            }
            values.push(currentValue.trim());

            if (values.length >= 7) {
              const [
                weight,
                width,
                length,
                height,
                checkoutLinksValue,
                productPortals,
                productNames,
              ] = values;

              parsedData.push({
                id: `${weight}-${width}-${length}-${height}-${Date.now()}-${i}`,
                weight: weight || '',
                width: width || '',
                length: length || '',
                height: height || '',
                checkoutLinks: checkoutLinksValue || '',
                productPortals: productPortals || '',
                productNames: productNames || '',
              });
            }
          }

          setCheckoutLinks(parsedData);

          fetch(resolveCheckoutLinksApiPath('/checkout-links'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              items: parsedData.map((item) => ({
                weight: item.weight || '',
                width: item.width || '',
                length: item.length || '',
                height: item.height || '',
                checkoutLinks: item.checkoutLinks || null,
                productPortals: item.productPortals || null,
                productNames: item.productNames || null,
              })),
            }),
          })
            .then((response) => response.json())
            .then((result) => {
              if (result.success) {
                showNotification({
                  title: 'Import Successful',
                  message:
                    result.message ||
                    `Successfully imported ${parsedData.length} checkout links`,
                  color: 'green',
                });
              } else {
                throw new Error(result.error || 'Failed to save to database');
              }
            })
            .catch((error) => {
              showNotification({
                title: 'Database Error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Failed to save to database',
                color: 'orange',
              });
            })
            .finally(() => {
              setIsImporting(false);
            });
        } catch (error) {
          showNotification({
            title: 'Import Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to parse CSV file',
            color: 'red',
          });
          setIsImporting(false);
        }
      };

      reader.onerror = () => {
        showNotification({
          title: 'Import Failed',
          message: 'Failed to read file',
          color: 'red',
        });
        setIsImporting(false);
      };

      reader.readAsText(file);
    },
    [resolveCheckoutLinksApiPath]
  );

  const handleExportCSV = useCallback(() => {
    if (!filteredCheckoutLinks.length) {
      showNotification({
        title: 'Export unavailable',
        message: 'No checkout links to export.',
        color: 'yellow',
      });
      return;
    }

    const headers = [
      'weight',
      'width',
      'length',
      'height',
      'checkoutLinks',
      'productPortals',
      'productNames',
    ];

    const escapeCsv = (value: unknown): string => {
      const normalized =
        value === null || value === undefined ? '' : String(value);
      if (
        normalized.includes(',') ||
        normalized.includes('"') ||
        normalized.includes('\n')
      ) {
        return `"${normalized.replace(/"/g, '""')}"`;
      }
      return normalized;
    };

    const rows = filteredCheckoutLinks.map((row) =>
      [
        row.weight,
        row.width,
        row.length,
        row.height,
        row.checkoutLinks,
        row.productPortals,
        row.productNames,
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `checkout-links-${getCurrentDateISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification({
      title: 'Export complete',
      message: `Exported ${filteredCheckoutLinks.length} checkout link rows.`,
      color: 'green',
    });
  }, [filteredCheckoutLinks]);

  const handleOpenProductsModule = useCallback(() => {
    if (typeof window !== 'undefined') {
      const productsPath =
        apiBasePath === '/api/general-merchandise'
          ? '/general-merchandise/operations/products'
          : '/clothing/operations/products';
      window.open(productsPath, '_blank');
    }
  }, [apiBasePath]);

  const sendInvoiceMessengerMessage = useCallback(
    async (invoice: InvoiceData, driveFilesOverride?: string) => {
      const facebookLink = lookupFacebookLink(invoice.customerName);

      if (!facebookLink) {
        showNotification({
          title: 'No Facebook Link',
          message: `No Facebook Messenger link found for ${invoice.customerName}`,
          color: 'yellow',
        });
        return false;
      }

      if (!invoiceSettings) {
        showNotification({
          title: 'Settings Not Loaded',
          message: 'Invoice message template is loading...',
          color: 'yellow',
        });
        return false;
      }

      const finalWeight = calculateFinalWeight(invoice.actualWeight);
      const shopeeCheckoutLink =
        findCheckoutLinkByWeight(finalWeight, checkoutLinks) || '';

      const message = generateInvoiceMessage(invoiceSettings.messageTemplate, {
        driveFilesUrl: driveFilesOverride ?? invoice.driveFiles ?? '',
        shopeeCheckoutLink,
        paymentChannelsUrl: invoiceSettings.paymentChannelsUrl,
      });

      const copied = await copyTextToClipboard(message);
      if (!copied) {
        showNotification({
          title: 'Copy Failed',
          message: 'Could not copy message to clipboard',
          color: 'red',
        });
        return false;
      }

      showNotification({
        title: 'Message Copied!',
        message: `Invoice message copied to clipboard. Opening Facebook Messenger...`,
        color: 'green',
      });

      const messengerUrl = facebookLink.startsWith('http')
        ? facebookLink
        : `https://${facebookLink}`;
      window.open(messengerUrl, '_blank');

      return true;
    },
    [checkoutLinks, invoiceSettings, lookupFacebookLink]
  );

  const handleLocalCustomerNameClick = useCallback(
    async (invoice: InvoiceData) => {
      const success = await sendInvoiceMessengerMessage(invoice, '');
      if (!success) {
        return;
      }

      setLocalInvoiceTickboxes((prev) => ({
        ...prev,
        [invoice.id]: true,
      }));
    },
    [sendInvoiceMessengerMessage, setLocalInvoiceTickboxes]
  );

  const handleLocalInvoiceTickboxChange = useCallback(
    (invoiceId: string, newValue: boolean) => {
      setLocalInvoiceTickboxes((prev) => ({
        ...prev,
        [invoiceId]: newValue,
      }));
    },
    [setLocalInvoiceTickboxes]
  );

  return {
    activeTab,
    setActiveTab,
    checkoutLinkForm,
    checkoutLinksState: {
      data: checkoutLinks,
      filteredData: filteredCheckoutLinks,
      isLoading,
      isImporting,
      pendingDeleteId,
      handleImportCSV,
      handleExportCSV,
      handleEdit,
      handleDelete,
      searchQuery: checkoutLinksSearchQuery,
      handleSearch: handleCheckoutLinksSearch,
    },
    localInvoicesState: {
      data: localInvoiceData,
      filteredData: filteredLocalInvoiceData,
      invoiceDateOptions: localInvoiceDateOptions,
      invoiceDateFilter: localInvoiceDateFilter,
      setInvoiceDateFilter: setLocalInvoiceDateFilter,
      handleCustomerNameClick: handleLocalCustomerNameClick,
      handleInvoiceTickboxChange: handleLocalInvoiceTickboxChange,
      hasFacebookLink,
      searchQuery: localInvoicingSearchQuery,
      handleSearch: handleLocalInvoicingSearch,
    },
    customerOrdersState: {
      data: customerOrders,
      filteredData: filteredCustomerOrders,
      isLoading: isCustomerOrdersLoading,
      searchQuery: customerOrdersSearchQuery,
      handleSearch: handleCustomerOrdersSearch,
    },
    itemWeightsState: {
      data: itemWeightData,
      filteredData: filteredItemWeightData,
      isItemWeightLoading,
      itemWeightError,
      handleOpenProductsModule,
      searchQuery: itemWeightSearchQuery,
      handleSearch: handleItemWeightSearch,
    },
    modalState: {
      isEditModalOpen,
      closeEditModal,
      checkoutLinkForm,
      handleUpdateCheckoutLink,
      isSavingCheckoutLink,
    },
    utilities: {
      calculateFinalWeight,
      findCheckoutLinkByWeight,
    },
  };
};
