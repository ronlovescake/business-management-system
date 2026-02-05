'use client';

import { PolishedModal } from '@/components/modals/PolishedModal';
import { CustomerDetailsView } from './CustomerDetailsView';

interface CustomerDetailsModalProps {
  opened: boolean;
  onClose: () => void;
  customerId: string;
  apiBasePath?: string;
}

export function CustomerDetailsModal({
  opened,
  onClose,
  customerId,
  apiBasePath,
}: CustomerDetailsModalProps) {
  return (
    <PolishedModal
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
          onBack={onClose}
        />
      </div>
    </PolishedModal>
  );
}
