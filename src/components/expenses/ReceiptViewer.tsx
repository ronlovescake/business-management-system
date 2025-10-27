'use client';

import React from 'react';
import { Modal, Group, Text, ActionIcon, Tooltip, Box } from '@mantine/core';
import {
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconDownload,
} from '@tabler/icons-react';
import { getIconButtonLabel } from '@/lib/accessibility';

interface ReceiptViewerProps {
  opened: boolean;
  onClose: () => void;
  receiptUrl: string | null;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDownload: () => void;
}

export function ReceiptViewer({
  opened,
  onClose,
  receiptUrl,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onDownload,
}: ReceiptViewerProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group justify="space-between" style={{ width: '100%' }}>
          <Text fw={600}>View Receipt</Text>
          <Group gap="xs">
            <Tooltip label="Zoom Out">
              <ActionIcon
                variant="light"
                onClick={onZoomOut}
                disabled={zoom <= 25}
                {...getIconButtonLabel('Zoom out receipt')}
              >
                <IconZoomOut size={18} />
              </ActionIcon>
            </Tooltip>
            <Text
              size="sm"
              fw={500}
              style={{ minWidth: 50, textAlign: 'center' }}
            >
              {zoom}%
            </Text>
            <Tooltip label="Zoom In">
              <ActionIcon
                variant="light"
                onClick={onZoomIn}
                disabled={zoom >= 300}
                {...getIconButtonLabel('Zoom in receipt')}
              >
                <IconZoomIn size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reset Zoom">
              <ActionIcon variant="light" onClick={onZoomReset} {...getIconButtonLabel('Reset zoom')}>
                <IconZoomReset size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Download Receipt">
              <ActionIcon variant="filled" color="blue" onClick={onDownload} {...getIconButtonLabel('Download receipt')}>
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      }
      size="90%"
      centered
      styles={{
        body: {
          maxHeight: '85vh',
          overflow: 'auto',
        },
      }}
    >
      {receiptUrl && (
        <Box
          style={{
            textAlign: 'center',
            padding: '20px',
            overflow: 'auto',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptUrl}
            alt="Receipt"
            style={{
              width: `${zoom}%`,
              maxWidth: 'none',
              height: 'auto',
              objectFit: 'contain',
              transition: 'width 0.2s ease',
            }}
          />
        </Box>
      )}
    </Modal>
  );
}
