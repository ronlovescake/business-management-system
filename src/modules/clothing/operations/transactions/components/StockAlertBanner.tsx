import { Alert } from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
} from '@tabler/icons-react';

interface StockAlertBannerProps {
  status: 'IN_STOCK' | 'LOW_STOCK' | 'INSUFFICIENT_STOCK' | 'SOLD_OUT';
  message: string;
  productCode: string;
  availableStock: number;
  onClose?: () => void;
}

/**
 * Displays stock availability alerts with color coding
 */
export function StockAlertBanner({
  status,
  message,
  onClose,
}: StockAlertBannerProps) {
  // Don't show banner for in-stock items
  if (status === 'IN_STOCK') {
    return null;
  }

  const getAlertProps = () => {
    switch (status) {
      case 'SOLD_OUT':
        return {
          color: 'red',
          title: '🔴 SOLD OUT',
          icon: <IconAlertCircle size={20} />,
        };
      case 'INSUFFICIENT_STOCK':
        return {
          color: 'red',
          title: '🔴 INSUFFICIENT STOCK',
          icon: <IconAlertCircle size={20} />,
        };
      case 'LOW_STOCK':
        return {
          color: 'yellow',
          title: '🟡 LOW STOCK WARNING',
          icon: <IconAlertTriangle size={20} />,
        };
      default:
        return {
          color: 'blue',
          title: 'Stock Check',
          icon: <IconCircleCheck size={20} />,
        };
    }
  };

  const alertProps = getAlertProps();

  return (
    <Alert
      variant="light"
      color={alertProps.color}
      title={alertProps.title}
      icon={alertProps.icon}
      withCloseButton={!!onClose}
      onClose={onClose}
      mb="md"
    >
      {message}
    </Alert>
  );
}
