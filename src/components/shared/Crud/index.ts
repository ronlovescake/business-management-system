/**
 * Generic CRUD Components
 *
 * Reusable, type-safe components for Create, Read, Update, Delete operations.
 * These components provide consistent UI/UX across the application while
 * maintaining full type safety through TypeScript generics.
 *
 * @example
 * ```tsx
 * import { CrudTable, CrudModal } from '@/components/shared/Crud';
 *
 * // Use the table
 * <CrudTable
 *   data={items}
 *   columns={columns}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 *
 * // Use the modal
 * <CrudModal
 *   opened={isOpen}
 *   onClose={close}
 *   title="Create Item"
 *   fields={fields}
 *   onSubmit={handleSubmit}
 * />
 * ```
 */

// Components
export { CrudTable } from './CrudTable';
export { CrudForm } from './CrudForm';
export { CrudModal } from './CrudModal';

// Types
export type {
  CrudTableProps,
  CrudTableColumn,
  CrudTableAction,
} from './CrudTable';

export type {
  CrudFormProps,
  CrudFormField,
  CrudFormFieldType,
} from './CrudForm';

export type { CrudModalProps } from './CrudModal';
