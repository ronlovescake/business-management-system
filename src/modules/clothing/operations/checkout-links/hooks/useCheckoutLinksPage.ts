import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useInvoiceCustomerLookup } from './useInvoiceCustomerLookup';
import { calculateFinalWeight } from '../utils/finalWeightCalculator';
import { findCheckoutLinkByWeight } from '../utils/checkoutLinkMatcher';
import { generateInvoiceMessage } from '../utils/messageGenerator';
import { copyTextToClipboard } from '../lib/clipboard';
import { hasWeightData, mapProductToItemWeight } from '../lib/weights';
import type {
  CheckoutLinkData,
  CheckoutLinkFormValues,
  InvoiceData,
  ItemWeightData,
} from '../types';
import type { ProductData } from '../../products/types/product.types';

interface InvoiceSettingsResponse {
  messageTemplate: string;
  paymentChannelsUrl: string;
}

export const useCheckoutLinksPage = () => {
  const [activeTab, setActiveTab] = useState<string | null>('invoicing');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLinks, setCheckoutLinks] = useState<CheckoutLinkData[]>([]);
  const [invoiceData, setInvoiceData] = useState<InvoiceData[]>([]);
  const [itemWeightData, setItemWeightData] = useState<ItemWeightData[]>([]);
  const [isItemWeightLoading, setIsItemWeightLoading] = useState(true);
  const [itemWeightError, setItemWeightError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCheckoutLink, setEditingCheckoutLink] =
    useState<CheckoutLinkData | null>(null);
  const [isSavingCheckoutLink, setIsSavingCheckoutLink] = useState(false);

  const { lookupFacebookLink, hasFacebookLink } = useInvoiceCustomerLookup();

  const { data: invoiceSettings } = useQuery<InvoiceSettingsResponse>({
    queryKey: ['invoice-settings'],
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

  const handleCalculateWeights = useCallback(async () => {
    try {
      const response = await fetch('/api/invoices/calculate-weights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || 'Failed to calculate weights. Please retry.'
        );
      }

      setInvoiceData(result.invoices);

      const { results } = result;
      const totalCalculated = results.length;
      const withUnmatched = results.filter(
        (r: { unmatchedProducts: string[] }) => r.unmatchedProducts.length > 0
      ).length;

      let message = `Successfully calculated weights for ${totalCalculated} invoice(s)`;
      if (withUnmatched > 0) {
        message += `. ${withUnmatched} invoice(s) have products without weight data.`;
      }

      showNotification({
        title: 'Weight Calculation Complete',
        message,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Calculation Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to calculate weights',
        color: 'red',
      });
    }
  }, []);

  const loadCheckoutLinks = useCallback(async () => {
    try {
      const response = await fetch('/api/checkout-links');
      const result = await response.json();

      if (result.data) {
        setCheckoutLinks(result.data);
      }
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load checkout links',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      const response = await fetch('/api/invoices');
      const result = await response.json();

      if (result.data) {
        setInvoiceData(result.data);

        if (result.data.length > 0) {
          void handleCalculateWeights();
        }
      }
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load invoices',
        color: 'red',
      });
    }
  }, [handleCalculateWeights]);

  const loadProductWeights = useCallback(async () => {
    setIsItemWeightLoading(true);
    setItemWeightError(null);

    try {
      const response = await fetch('/api/products');

      if (!response.ok) {
        throw new Error('Failed to load product weights');
      }

      const payload = (await response.json()) as
        | ProductData[]
        | { data?: ProductData[] }
        | undefined;
      let products: ProductData[] = [];

      if (Array.isArray(payload)) {
        products = payload;
      } else if (payload && Array.isArray(payload.data)) {
        products = payload.data;
      }

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
  }, []);

  useEffect(() => {
    void loadCheckoutLinks();
  }, [loadCheckoutLinks]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    void loadProductWeights();
  }, [loadProductWeights]);

  const filteredCheckoutLinks = useMemo(() => {
    if (!searchQuery.trim()) {
      return checkoutLinks;
    }

    const query = searchQuery.toLowerCase();
    return checkoutLinks.filter((item) =>
      [
        item.weight,
        item.width,
        item.length,
        item.height,
        item.checkoutLinks,
        item.productPortals,
        item.productNames,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query))
    );
  }, [checkoutLinks, searchQuery]);

  const filteredInvoiceData = useMemo(() => {
    if (!searchQuery.trim()) {
      return invoiceData;
    }

    const query = searchQuery.toLowerCase();
    return invoiceData.filter((item) =>
      [
        item.customerName,
        item.actualWeight,
        item.finalWeight,
        item.shopeeCheckoutLinks,
        item.driveFiles,
        item.message,
        item.chat,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query))
    );
  }, [invoiceData, searchQuery]);

  const filteredItemWeightData = useMemo(() => {
    if (!searchQuery.trim()) {
      return itemWeightData;
    }

    const query = searchQuery.toLowerCase();
    return itemWeightData.filter((item) => {
      const candidates = [
        item.itemName,
        item.productCode ?? '',
        item.bulkQuantity,
        item.bulkWeight,
        item.approxWeightPerPiece,
      ];
      return candidates.some((field) => field.toLowerCase().includes(query));
    });
  }, [itemWeightData, searchQuery]);

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
          `/api/checkout-links?id=${encodeURIComponent(item.id)}`,
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
    []
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

        const response = await fetch('/api/checkout-links', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

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
    [closeEditModal, editingCheckoutLink]
  );

  const handleImportCSV = useCallback((file: File | null) => {
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

        const headers = lines[0].split(',').map((h) => h.trim().toUpperCase());
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

        fetch('/api/checkout-links', {
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
            error instanceof Error ? error.message : 'Failed to parse CSV file',
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
  }, []);

  const handleExportCSV = useCallback(() => {
    // TODO: Implement CSV export functionality
  }, []);

  const handleSyncGoogleDrive = useCallback(async () => {
    setIsSyncing(true);

    try {
      const response = await fetch('/api/google-drive/sync-files');
      const result = await response.json();

      if (!result.success) {
        if (result.setupInstructions) {
          showNotification({
            title: 'Google Drive Not Configured',
            message:
              result.error ||
              'Please configure Google Drive credentials in your environment variables. Check .env.example for setup instructions.',
            color: 'yellow',
            autoClose: 10000,
          });
          return;
        }

        if (result.instructions) {
          showNotification({
            title: 'Package Not Installed',
            message: result.instructions,
            color: 'yellow',
            autoClose: 10000,
          });
          return;
        }

        throw new Error(result.error || 'Failed to sync Google Drive files');
      }

      const syncedData: InvoiceData[] = result.data.map(
        (item: {
          customerName: string;
          driveFiles: string;
          fileId: string;
          fileName: string;
        }) => ({
          id: item.fileId || `temp-${Date.now()}-${Math.random()}`,
          customerName: item.customerName,
          actualWeight: '',
          finalWeight: '',
          shopeeCheckoutLinks: '',
          driveFiles: item.driveFiles,
          message: '',
          chat: '',
          tickbox: false,
        })
      );

      const saveResponse = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoices: syncedData }),
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok || !saveResult.success) {
        throw new Error(
          saveResult.error || 'Failed to save invoices to database'
        );
      }

      setInvoiceData(saveResult.data);

      showNotification({
        title: 'Sync Successful',
        message: `Successfully synced and saved ${syncedData.length} files from Google Drive`,
        color: 'green',
      });

      void handleCalculateWeights();
    } catch (error) {
      showNotification({
        title: 'Sync Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to sync Google Drive files',
        color: 'red',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [handleCalculateWeights]);

  const handleOpenProductsModule = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open('/clothing/operations/products', '_blank');
    }
  }, []);

  const updateInvoiceTickbox = useCallback(
    async (invoiceId: string, tickbox: boolean) => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/tickbox`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tickbox }),
        });

        if (!response.ok) {
          throw new Error('Failed to update tickbox');
        }

        return true;
      } catch (error) {
        showNotification({
          title: 'Error',
          message: 'Failed to update message sent status',
          color: 'red',
        });
        return false;
      }
    },
    []
  );

  const handleInvoiceTickboxChange = useCallback(
    async (invoiceId: string, newValue: boolean) => {
      const newData = invoiceData.map((item) =>
        item.id === invoiceId ? { ...item, tickbox: newValue } : item
      );
      setInvoiceData(newData);

      const success = await updateInvoiceTickbox(invoiceId, newValue);
      if (!success) {
        setInvoiceData(invoiceData);
      }
    },
    [invoiceData, updateInvoiceTickbox]
  );

  const handleCustomerNameClick = useCallback(
    async (invoice: InvoiceData) => {
      const facebookLink = lookupFacebookLink(invoice.customerName);

      if (!facebookLink) {
        showNotification({
          title: 'No Facebook Link',
          message: `No Facebook Messenger link found for ${invoice.customerName}`,
          color: 'yellow',
        });
        return;
      }

      if (!invoiceSettings) {
        showNotification({
          title: 'Settings Not Loaded',
          message: 'Invoice message template is loading...',
          color: 'yellow',
        });
        return;
      }

      const finalWeight = calculateFinalWeight(invoice.actualWeight);
      const shopeeCheckoutLink =
        findCheckoutLinkByWeight(finalWeight, checkoutLinks) || '';

      const message = generateInvoiceMessage(invoiceSettings.messageTemplate, {
        driveFilesUrl: invoice.driveFiles || '',
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
        return;
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

      const updated = await updateInvoiceTickbox(invoice.id, true);
      if (updated) {
        setInvoiceData((prev) =>
          prev.map((item) =>
            item.id === invoice.id ? { ...item, tickbox: true } : item
          )
        );
      }
    },
    [checkoutLinks, invoiceSettings, lookupFacebookLink, updateInvoiceTickbox]
  );

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
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
    },
    invoicesState: {
      data: invoiceData,
      filteredData: filteredInvoiceData,
      isSyncing,
      handleSyncGoogleDrive,
      handleCustomerNameClick,
      handleInvoiceTickboxChange,
      hasFacebookLink,
    },
    itemWeightsState: {
      data: itemWeightData,
      filteredData: filteredItemWeightData,
      isItemWeightLoading,
      itemWeightError,
      handleOpenProductsModule,
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
