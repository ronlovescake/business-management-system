'use client';

import { UniversalModal } from '@/components/modals/UniversalModal';
import { CustomerDetailsView } from './CustomerDetailsView';

interface CustomerDetailsModalProps {
  opened: boolean;
  onClose: () => void;
  customerId: string;
  apiBasePath?: string;
  customerApiBasePath?: string;
}

export function CustomerDetailsModal({
  opened,
  onClose,
  customerId,
  apiBasePath,
  customerApiBasePath,
}: CustomerDetailsModalProps) {
  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title={null}
      size={1750}
      withCloseButton
      closeOnClickOutside
      closeOnEscape
    >
      <div style={{ maxHeight: '82vh', overflowY: 'auto' }}>
        <CustomerDetailsView
          customerId={customerId}
          apiBasePath={apiBasePath}
          customerApiBasePath={customerApiBasePath}
          onBack={onClose}
        />
      </div>
    </UniversalModal>
  );
}
