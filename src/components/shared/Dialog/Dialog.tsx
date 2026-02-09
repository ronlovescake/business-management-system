/**
 * Dialog Component
 *
 * Highly reusable and modular dialog/modal component for the entire codebase.
 *
 * Features:
 * - Flexible composition (use sub-components or all-in-one)
 * - Configurable size, centering, overlay
 * - Support for headers, bodies, footers
 * - Loading states
 * - Fully typed with TypeScript
 *
 * Usage Examples:
 *
 * 1. Simple Dialog:
 * ```tsx
 * <Dialog opened={isOpen} onClose={close} title="My Dialog">
 *   <Text>Content here</Text>
 * </Dialog>
 * ```
 *
 * 2. Composed Dialog:
 * ```tsx
 * <Dialog opened={isOpen} onClose={close}>
 *   <DialogHeader title="My Dialog" subtitle="Details here" />
 *   <DialogBody>
 *     <Stack gap="md">
 *       <TextInput label="Name" />
 *       <TextInput label="Email" />
 *     </Stack>
 *   </DialogBody>
 *   <DialogFooter
 *     secondaryButton={{ label: 'Cancel', onClick: close }}
 *     primaryButton={{ label: 'Save', onClick: save }}
 *   />
 * </Dialog>
 * ```
 *
 * 3. All-in-one Config:
 * ```tsx
 * <ComposedDialog
 *   opened={isOpen}
 *   onClose={close}
 *   header={{ title: 'My Dialog', subtitle: 'Details' }}
 *   footer={{
 *     secondaryButton: { label: 'Cancel', onClick: close },
 *     primaryButton: { label: 'Save', onClick: save }
 *   }}
 * >
 *   <Stack gap="md">
 *     <TextInput label="Name" />
 *     <TextInput label="Email" />
 *   </Stack>
 * </ComposedDialog>
 * ```
 */

import { Stack, Loader, Center } from '@mantine/core';
import type { DialogProps, ComposedDialogProps } from './Dialog.types';
import { DialogHeader } from './DialogHeader';
import { DialogBody } from './DialogBody';
import { DialogFooter } from './DialogFooter';
import { UniversalModal } from '@/components/modals/UniversalModal';

/**
 * Base Dialog Component
 *
 * Use this for maximum flexibility. Compose with DialogHeader,
 * DialogBody, and DialogFooter as needed.
 */
export function Dialog({
  opened,
  onClose,
  title,
  children,
  size = 'md',
  centered = true,
  fullScreen = false,
  closeOnClickOutside = true,
  closeOnEscape = true,
  withCloseButton = true,
  zIndex,
  className,
  overlayOpacity = 0.55,
  overlayBlur = 3,
  padding = 'lg',
  loading = false,
}: DialogProps) {
  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title={title}
      size={size}
      centered={centered}
      fullScreen={fullScreen}
      closeOnClickOutside={closeOnClickOutside}
      closeOnEscape={closeOnEscape}
      withCloseButton={withCloseButton}
      zIndex={zIndex}
      className={className}
      overlayProps={{
        opacity: overlayOpacity,
        blur: overlayBlur,
      }}
      padding={padding}
    >
      {loading ? (
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        children
      )}
    </UniversalModal>
  );
}

/**
 * Composed Dialog Component
 *
 * All-in-one component with automatic header, body, and footer rendering
 * based on configuration props.
 */
export function ComposedDialog({
  opened,
  onClose,
  children,
  header,
  body,
  footer,
  ...dialogProps
}: ComposedDialogProps) {
  return (
    <Dialog
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      {...dialogProps}
    >
      <Stack gap={0}>
        {header && (
          <DialogHeader
            {...header}
            withCloseButton={dialogProps.withCloseButton ?? true}
            onClose={onClose}
          />
        )}

        <DialogBody {...body}>{children}</DialogBody>

        {footer && <DialogFooter {...footer} />}
      </Stack>
    </Dialog>
  );
}

// Export sub-components for flexible composition
export { DialogHeader } from './DialogHeader';
export { DialogBody } from './DialogBody';
export { DialogFooter } from './DialogFooter';

// Export types
export * from './Dialog.types';
