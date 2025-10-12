import { useState, useCallback } from 'react';

/**
 * Custom hook for managing receipt files and viewer
 *
 * Provides:
 * - Receipt file storage as data URLs
 * - Receipt viewer state management
 * - Zoom controls
 * - Upload and view handlers
 *
 * @returns Receipt management utilities
 */
export function useReceiptManager() {
  const [receiptFiles, setReceiptFiles] = useState<Record<string, string>>({});
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptZoom, setReceiptZoom] = useState(100);
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  /**
   * Store a receipt file as data URL
   */
  const storeReceipt = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const fileName = file.name;

        setReceiptFiles((prev) => ({
          ...prev,
          [fileName]: dataUrl,
        }));

        resolve(fileName);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Open receipt viewer
   */
  const viewReceipt = useCallback(
    (receiptName: string) => {
      const receiptData = receiptFiles[receiptName];
      if (receiptData) {
        setViewingReceipt(receiptData);
        setReceiptFileName(receiptName);
        setReceiptZoom(100);
        setReceiptModalOpen(true);
      } else {
        alert('Receipt file not found. This may be a pre-existing receipt.');
      }
    },
    [receiptFiles]
  );

  /**
   * Close receipt viewer
   */
  const closeViewer = useCallback(() => {
    setReceiptModalOpen(false);
    setReceiptZoom(100);
  }, []);

  /**
   * Zoom controls
   */
  const zoomIn = useCallback(() => {
    setReceiptZoom((prev) => Math.min(300, prev + 25));
  }, []);

  const zoomOut = useCallback(() => {
    setReceiptZoom((prev) => Math.max(25, prev - 25));
  }, []);

  const zoomReset = useCallback(() => {
    setReceiptZoom(100);
  }, []);

  /**
   * Download receipt
   */
  const downloadReceipt = useCallback(() => {
    if (viewingReceipt) {
      const link = document.createElement('a');
      link.href = viewingReceipt;
      link.download = receiptFileName || 'receipt';
      link.click();
    }
  }, [viewingReceipt, receiptFileName]);

  return {
    // State
    receiptFiles,
    viewingReceipt,
    receiptModalOpen,
    receiptZoom,
    receiptFileName,

    // Actions
    storeReceipt,
    viewReceipt,
    closeViewer,
    zoomIn,
    zoomOut,
    zoomReset,
    downloadReceipt,
  };
}
