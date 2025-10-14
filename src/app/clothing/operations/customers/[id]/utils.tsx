import {
  IconClock,
  IconPackage,
  IconTruck,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import type { OrderStatus } from './types';

// ============================================================================
// STATUS HELPERS
// ============================================================================

export function getStatusColor(status: OrderStatus | string): string {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'processing':
      return 'blue';
    case 'shipped':
      return 'grape';
    case 'delivered':
      return 'green';
    case 'cancelled':
      return 'red';
    default:
      return 'gray';
  }
}

export function getStatusIcon(status: OrderStatus | string): React.ReactNode {
  const iconSize = 14;

  switch (status) {
    case 'pending':
      return <IconClock size={iconSize} />;
    case 'processing':
      return <IconPackage size={iconSize} />;
    case 'shipped':
      return <IconTruck size={iconSize} />;
    case 'delivered':
      return <IconCheck size={iconSize} />;
    case 'cancelled':
      return <IconX size={iconSize} />;
    default:
      return <IconClock size={iconSize} />;
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

export function formatCurrency(value: number): string {
  return `₱${value.toLocaleString()}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

export function getRateColor(rate: number, isFailure = false): string {
  if (isFailure) {
    // For failure/cancellation rates (lower is better)
    if (rate <= 10) {
      return 'green';
    }
    if (rate <= 20) {
      return 'yellow';
    }
    return 'red';
  } else {
    // For success/completion rates (higher is better)
    if (rate >= 80) {
      return 'green';
    }
    if (rate >= 60) {
      return 'yellow';
    }
    return 'red';
  }
}
