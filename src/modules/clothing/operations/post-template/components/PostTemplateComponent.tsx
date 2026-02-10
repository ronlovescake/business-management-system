/**
 * Post Template Component
 * Main component for managing social media post templates
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Stack,
  Select,
  ActionIcon,
  Text,
  Paper,
  Textarea,
  Button,
  Group,
} from '@mantine/core';
import { IconCopy, IconPencil } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { showCustomAlert } from '@/lib/alerts';
import { DEFAULT_POST_TEMPLATE_NOTICE } from '@/modules/clothing/operations/post-template/notice.data';
import type { PostTemplateNotice } from '@/modules/clothing/operations/post-template/notice.types';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { UniversalModal } from '@/components/modals/UniversalModal';

interface Product {
  id: string;
  ['Product Code']: string;
  Product?: string;
  ['Age Range']?: string;
  ['Shipment Status']?: string;
}

interface Price {
  id: number;
  ['Product Code']: string;
  ['Lower Limit']: number;
  ['Upper Limit']: number;
  Prices: number;
  ['Price Adjustment']: number;
}

const normalizeProductCode = (code: Product['Product Code']) => {
  if (typeof code !== 'string') {
    return null;
  }

  const trimmed = code.trim();
  return trimmed.length > 0 ? trimmed : null;
};

interface PostTemplateComponentProps {
  apiBasePath?: string;
}

export function PostTemplateComponent({
  apiBasePath,
}: PostTemplateComponentProps) {
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    null
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const cloneNotice = (notice: PostTemplateNotice): PostTemplateNotice => ({
    ...notice,
    introParagraphs: [...notice.introParagraphs],
    bulletPoints: [...notice.bulletPoints],
  });
  const [notice, setNotice] = useState<PostTemplateNotice>(() =>
    cloneNotice(DEFAULT_POST_TEMPLATE_NOTICE)
  );
  const [loadingNotice, setLoadingNotice] = useState(true);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeEditValues, setNoticeEditValues] = useState({
    paragraphs: '',
    bullets: '',
  });
  const [noticeSnapshot, setNoticeSnapshot] = useState({
    paragraphs: '',
    bullets: '',
  });
  const [savingNotice, setSavingNotice] = useState(false);

  const productOptions = useMemo(
    () =>
      // Ensure Mantine Select receives only normalized string values
      Array.from(
        new Set(
          products
            .map((product) => normalizeProductCode(product['Product Code']))
            .filter((code): code is string => Boolean(code))
        )
      ).map((code) => ({
        value: code,
        label: code,
      })),
    [products]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, pricesRes, noticeRes] = await Promise.all([
          fetch(buildApiPath(apiBasePath, '/products')),
          fetch(buildApiPath(apiBasePath, '/prices')),
          fetch(buildApiPath(apiBasePath, '/post-template-notice')),
        ]);

        if (!productsRes.ok || !pricesRes.ok) {
          throw new Error('Failed to load products or prices');
        }

        const [productsPayload, pricesPayload, noticePayload] =
          await Promise.all([
            productsRes.json(),
            pricesRes.json(),
            noticeRes.json().catch(() => ({})),
          ]);

        const unwrapArray = (payload: unknown) => {
          if (Array.isArray(payload)) {
            return payload;
          }
          if (
            payload &&
            typeof payload === 'object' &&
            Array.isArray((payload as { data?: unknown }).data)
          ) {
            return (payload as { data: unknown[] }).data;
          }
          return [] as unknown[];
        };

        const validProducts = unwrapArray(productsPayload) as Product[];
        const validPrices = unwrapArray(pricesPayload) as Price[];
        const fetchedNotice =
          (noticePayload && typeof noticePayload === 'object'
            ? ((noticePayload as { data?: unknown }).data as
                | PostTemplateNotice
                | undefined)
            : undefined) || undefined;

        setProducts(validProducts);
        setPrices(validPrices);
        if (fetchedNotice) {
          setNotice(cloneNotice(fetchedNotice));
        } else {
          setNotice(cloneNotice(DEFAULT_POST_TEMPLATE_NOTICE));
        }
      } catch (error) {
        showNotification({
          title: 'Load failed',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to load post template data',
          color: 'red',
        });
        setProducts([]);
        setPrices([]);
        setNotice(cloneNotice(DEFAULT_POST_TEMPLATE_NOTICE));
      } finally {
        setLoadingNotice(false);
      }
    }
    fetchData();
  }, [apiBasePath]);

  // Find selected product based on product code
  const selectedProduct =
    products.find(
      (product) =>
        normalizeProductCode(product['Product Code']) === selectedProductCode
    ) || null;

  // Find all matching prices for selected product (multiple price tiers)
  const matchingPrices = selectedProduct
    ? prices
        .filter(
          (price) =>
            normalizeProductCode(price['Product Code']) === selectedProductCode
        )
        .sort((a, b) => b['Lower Limit'] - a['Lower Limit']) // Sort by lower limit descending
    : [];

  // Determine "Arrives In" text based on Shipment Status
  const getArrivesInText = () => {
    if (!selectedProduct) {
      return '3-4 weeks from posting date';
    }

    const shipmentStatus = selectedProduct['Shipment Status'];
    const onhandStatuses = ['For Pickup', 'Sorting', 'Delivered'];

    if (shipmentStatus && onhandStatuses.includes(shipmentStatus)) {
      return 'ONHAND!!!';
    }

    return '3-4 weeks from posting date';
  };

  // Determine header text based on Shipment Status
  const getHeaderText = () => {
    if (!selectedProduct) {
      return 'OPEN FOR RESERVATION';
    }

    const shipmentStatus = selectedProduct['Shipment Status'];
    const onhandStatuses = ['For Pickup', 'Sorting', 'Delivered'];

    if (shipmentStatus && onhandStatuses.includes(shipmentStatus)) {
      return 'ONHAND!!!';
    }

    return 'OPEN FOR RESERVATION';
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        logger.warn('Clipboard writeText failed, using fallback', error);
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  };

  const handleCopyCanvas = async () => {
    if (!selectedProduct) {
      return;
    }

    // Build the text content to copy
    const priceLines = matchingPrices
      .map(
        (price) =>
          `₱${price.Prices.toFixed(2)} / pc [Minimum Order: ${price['Lower Limit']} pc]`
      )
      .join('\n');

    const arrivesInText = getArrivesInText();
    const headerText = getHeaderText();

    const introParagraphs = notice.introParagraphs.join('\n\n');
    const bulletList = notice.bulletPoints
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n');

    const canvasText = `${headerText}

${selectedProduct['Product Code']}

Age Range: ${selectedProduct['Age Range'] || 'N/A'}

${priceLines}

Arrives In: ${arrivesInText}

  ${introParagraphs}

  First-time buyers must provide the following details:
  ${bulletList}`;

    try {
      const copied = await copyTextToClipboard(canvasText);
      if (!copied) {
        throw new Error('copy_failed');
      }
      showNotification({
        title: 'Success',
        message: 'Canvas content copied to clipboard!',
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to copy to clipboard. Please try again.',
        color: 'red',
      });
    }
  };

  const parseParagraphs = (value: string) =>
    value
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

  const parseBullets = (value: string) =>
    value
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const openNoticeEditor = async () => {
    const confirmation = await showCustomAlert({
      title: 'Edit notice copy?',
      text: 'Changes update the shared block on the Post Template canvas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Continue editing',
      cancelButtonText: 'Cancel',
      focusCancel: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setNoticeEditValues({
      paragraphs: notice.introParagraphs.join('\n\n'),
      bullets: notice.bulletPoints.join('\n'),
    });
    setNoticeSnapshot({
      paragraphs: notice.introParagraphs.join('\n\n'),
      bullets: notice.bulletPoints.join('\n'),
    });
    setNoticeModalOpen(true);
  };

  const closeNoticeEditor = () => {
    setNoticeModalOpen(false);
    setNoticeSnapshot({ paragraphs: '', bullets: '' });
  };

  const hasNoticeChanges =
    noticeEditValues.paragraphs.trim() !== noticeSnapshot.paragraphs.trim() ||
    noticeEditValues.bullets.trim() !== noticeSnapshot.bullets.trim();

  const introParagraphEntries = useMemo(() => {
    const occurrences = new Map<string, number>();
    return notice.introParagraphs.map((paragraph) => {
      const occurrenceIndex = occurrences.get(paragraph) ?? 0;
      occurrences.set(paragraph, occurrenceIndex + 1);
      return {
        paragraph,
        key: `${paragraph}-${occurrenceIndex}`,
      };
    });
  }, [notice.introParagraphs]);

  const bulletPointEntries = useMemo(() => {
    const occurrences = new Map<string, number>();
    return notice.bulletPoints.map((item, index) => {
      const occurrenceIndex = occurrences.get(item) ?? 0;
      occurrences.set(item, occurrenceIndex + 1);
      return {
        key: `${item}-${occurrenceIndex}`,
        label: item,
        order: index + 1,
      };
    });
  }, [notice.bulletPoints]);

  const handleSaveNotice = async () => {
    const introParagraphs = parseParagraphs(noticeEditValues.paragraphs);
    const bulletPoints = parseBullets(noticeEditValues.bullets);

    if (introParagraphs.length === 0) {
      showNotification({
        title: 'Validation error',
        message: 'Add at least one intro paragraph.',
        color: 'red',
      });
      return;
    }

    if (bulletPoints.length === 0) {
      showNotification({
        title: 'Validation error',
        message: 'Add at least one bullet point.',
        color: 'red',
      });
      return;
    }

    try {
      setSavingNotice(true);
      const response = await fetch(
        buildApiPath(apiBasePath, '/post-template-notice'),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ introParagraphs, bulletPoints }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update notice');
      }

      const result = await response.json();
      const updatedNotice = result.data as PostTemplateNotice;
      setNotice(cloneNotice(updatedNotice));
      showNotification({
        title: 'Notice updated',
        message: 'Post Template notice updated successfully.',
        color: 'green',
      });
      closeNoticeEditor();
    } catch (error) {
      showNotification({
        title: 'Save failed',
        message:
          error instanceof Error ? error.message : 'Failed to update notice',
        color: 'red',
      });
    } finally {
      setSavingNotice(false);
    }
  };

  return (
    <Stack gap="md">
      <Select
        placeholder="Select a product..."
        data={productOptions}
        value={selectedProductCode}
        onChange={(value) => setSelectedProductCode(value)}
        searchable
        clearable
        size="md"
        limit={1000}
        maxDropdownHeight={400}
        styles={{
          input: {
            '&:focus': {
              borderColor: 'var(--mantine-color-blue-6)',
            },
          },
        }}
        nothingFoundMessage="No products found"
      />

      {selectedProduct && (
        <>
          <Paper withBorder p="md" bg="#f8f9fa">
            <Text size="sm" fw={500} mb="xs">
              Selected Product:
            </Text>
            <Text size="md" fw={600} c="blue">
              {selectedProduct['Product Code']}
            </Text>
          </Paper>

          <Paper
            withBorder
            style={{
              backgroundColor: '#ffffff',
              minHeight: '500px',
              width: '100%',
              padding: '40px',
              position: 'relative',
            }}
          >
            {/* Copy Button */}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={handleCopyCanvas}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
              }}
              title="Copy canvas content"
            >
              <IconCopy size={20} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="blue"
              size="lg"
              onClick={openNoticeEditor}
              style={{
                position: 'absolute',
                top: '10px',
                right: '50px',
              }}
              title="Edit notice copy"
            >
              <IconPencil size={20} />
            </ActionIcon>

            <Stack gap="lg" align="center">
              <Text size="xl" fw={700} c="red" style={{ letterSpacing: '1px' }}>
                {getHeaderText()}
              </Text>

              <Stack gap="xs" align="center">
                <Text size="lg" fw={600} ta="center">
                  {selectedProduct['Product Code']}
                </Text>

                <Text size="md" c="dimmed" ta="center">
                  Age Range: {selectedProduct['Age Range'] || 'N/A'}
                </Text>

                {matchingPrices.length > 0 && (
                  <Stack gap="xs" mt="md" align="center">
                    {matchingPrices.map((price) => (
                      <Text key={price.id} size="lg" fw={600} ta="center">
                        ₱{price.Prices.toFixed(2)} / pc [Minimum Order:{' '}
                        {price['Lower Limit']} pc]
                      </Text>
                    ))}
                  </Stack>
                )}

                {/* Arrives In Section */}
                <Stack
                  gap="md"
                  mt="xl"
                  align="flex-start"
                  style={{ width: '100%' }}
                >
                  <Text size="md" fw={600}>
                    Arrives In: {getArrivesInText()}
                  </Text>
                  {loadingNotice ? (
                    <Text size="sm" c="dimmed">
                      Loading notice content...
                    </Text>
                  ) : (
                    <>
                      {introParagraphEntries.map(({ paragraph, key }) => (
                        <Text key={key} size="sm" style={{ lineHeight: 1.6 }}>
                          {paragraph}
                        </Text>
                      ))}

                      <Text size="md" fw={600} mt="md">
                        First-time buyers must provide the following details:
                      </Text>

                      <Stack gap="xs" style={{ paddingLeft: '20px' }}>
                        {bulletPointEntries.map(({ key, label, order }) => (
                          <Text key={key} size="sm">
                            {order}. {label}
                          </Text>
                        ))}
                      </Stack>
                    </>
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}

      <UniversalModal
        opened={noticeModalOpen}
        onClose={closeNoticeEditor}
        title="Edit notice copy"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Textarea
            label="Intro paragraphs"
            description="Separate paragraphs with a blank line"
            minRows={8}
            autosize
            value={noticeEditValues.paragraphs}
            onChange={(event) =>
              setNoticeEditValues((prev) => ({
                ...prev,
                paragraphs: event.currentTarget.value,
              }))
            }
          />
          <Textarea
            label="Bullet points"
            description="Enter one bullet per line"
            minRows={6}
            autosize
            value={noticeEditValues.bullets}
            onChange={(event) =>
              setNoticeEditValues((prev) => ({
                ...prev,
                bullets: event.currentTarget.value,
              }))
            }
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={closeNoticeEditor}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotice}
              disabled={!hasNoticeChanges || savingNotice}
              loading={savingNotice}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </UniversalModal>
    </Stack>
  );
}
