/**
 * Generic CRUD Modal Component
 *
 * A reusable modal component that combines CrudForm with Dialog/Modal
 * for Create/Update operations. Provides consistent UI/UX across the application.
 *
 * @example
 * ```tsx
 * <CrudModal
 *   opened={isOpen}
 *   onClose={handleClose}
 *   title={editing ? 'Edit Leave Request' : 'Create Leave Request'}
 *   fields={[
 *     { name: 'employeeName', label: 'Employee Name', type: 'text', required: true },
 *     { name: 'leaveType', label: 'Leave Type', type: 'select', options: ['Sick', 'Vacation'] },
 *     { name: 'startDate', label: 'Start Date', type: 'date', required: true }
 *   ]}
 *   initialValues={editingItem}
 *   onSubmit={handleSubmit}
 *   loading={saving}
 * />
 * ```
 */

import { Modal } from '@mantine/core';
import { CrudForm } from './CrudForm';
import type { CrudFormProps } from './CrudForm';

/**
 * Props for CrudModal component
 */
export interface CrudModalProps<T extends Record<string, unknown>>
  extends Omit<CrudFormProps<T>, 'onCancel' | 'hideActions'> {
  /** Modal open state */
  opened: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal subtitle */
  subtitle?: string;
  /** Modal size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Center modal */
  centered?: boolean;
  /** Close on click outside */
  closeOnClickOutside?: boolean;
  /** Close on escape key */
  closeOnEscape?: boolean;
}

/**
 * Generic CRUD Modal Component
 *
 * Combines modal and form functionality for create/edit operations.
 * Automatically handles form submission, cancellation, and modal closing.
 */
export function CrudModal<T extends Record<string, unknown>>({
  opened,
  onClose,
  title,
  subtitle,
  size = 'md',
  centered = true,
  closeOnClickOutside = true,
  closeOnEscape = true,
  fields,
  initialValues,
  onSubmit,
  submitLabel,
  cancelLabel = 'Cancel',
  loading,
  validate,
  customActions,
}: CrudModalProps<T>) {
  const handleSubmit = async (values: T) => {
    await onSubmit(values);
    // Don't auto-close - let parent decide based on success/failure
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size={size}
      centered={centered}
      closeOnClickOutside={closeOnClickOutside && !loading}
      closeOnEscape={closeOnEscape && !loading}
      withCloseButton={!loading}
    >
      {subtitle && (
        <div style={{ marginBottom: 16, color: 'var(--mantine-color-dimmed)' }}>
          {subtitle}
        </div>
      )}

      <CrudForm
        fields={fields}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel={submitLabel}
        cancelLabel={cancelLabel}
        loading={loading}
        validate={validate}
        customActions={customActions}
      />
    </Modal>
  );
}
