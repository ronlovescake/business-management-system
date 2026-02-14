'use client';

import { useState } from 'react';
import type { CustomerWarningData } from '../types/transaction.types';

interface UseCustomerWarningStateReturn {
  showCustomerWarningModal: boolean;
  customerWarningData: CustomerWarningData | null;
  setCustomerWarningData: (data: CustomerWarningData | null) => void;
  setShowCustomerWarningModal: (show: boolean) => void;
}

export function useCustomerWarningState(): UseCustomerWarningStateReturn {
  const [showCustomerWarningModal, setShowCustomerWarningModal] =
    useState(false);
  const [customerWarningData, setCustomerWarningData] =
    useState<CustomerWarningData | null>(null);

  return {
    showCustomerWarningModal,
    customerWarningData,
    setCustomerWarningData,
    setShowCustomerWarningModal,
  };
}
