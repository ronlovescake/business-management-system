/**
 * Dialog Component Type Definitions
 *
 * Provides flexible, reusable types for dialog/modal components
 * across the entire codebase.
 */

import { ReactNode } from 'react';
import { MantineSize } from '@mantine/core';

/**
 * Dialog Size Options
 */
export type DialogSize = MantineSize | 'xl' | 'full';

/**
 * Dialog Button Variant
 */
export type DialogButtonVariant =
  | 'filled'
  | 'light'
  | 'outline'
  | 'subtle'
  | 'default'
  | 'white'
  | 'gradient';

/**
 * Dialog Button Configuration
 */
export interface DialogButton {
  /** Button label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button color */
  color?: string;
  /** Button variant */
  variant?: DialogButtonVariant;
  /** Disable button */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Left icon */
  leftIcon?: ReactNode;
  /** Right icon */
  rightIcon?: ReactNode;
}

/**
 * Dialog Footer Layout Options
 */
export type DialogFooterLayout =
  | 'space-between'
  | 'flex-end'
  | 'flex-start'
  | 'center';

/**
 * Dialog Props
 */
export interface DialogProps {
  /** Control dialog open/close state */
  opened: boolean;
  /** Close handler */
  onClose: () => void;
  /** Dialog title */
  title?: ReactNode;
  /** Dialog content */
  children: ReactNode;
  /** Dialog size */
  size?: DialogSize;
  /** Center dialog vertically */
  centered?: boolean;
  /** Full screen on mobile */
  fullScreen?: boolean;
  /** Disable closing on click outside */
  closeOnClickOutside?: boolean;
  /** Disable closing on escape */
  closeOnEscape?: boolean;
  /** Hide close button */
  withCloseButton?: boolean;
  /** Z-index */
  zIndex?: number;
  /** Custom class name */
  className?: string;
  /** Overlay opacity */
  overlayOpacity?: number;
  /** Overlay blur */
  overlayBlur?: number;
  /** Padding */
  padding?: MantineSize;
  /** Show loader */
  loading?: boolean;
}

/**
 * Dialog Header Props
 */
export interface DialogHeaderProps {
  /** Header title */
  title: ReactNode;
  /** Subtitle text */
  subtitle?: string;
  /** Show close button */
  withCloseButton?: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Custom icon */
  icon?: ReactNode;
  /** Icon color */
  iconColor?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Dialog Body Props
 */
export interface DialogBodyProps {
  /** Body content */
  children: ReactNode;
  /** Custom padding */
  padding?: MantineSize;
  /** Custom class name */
  className?: string;
  /** Max height with scroll */
  maxHeight?: string | number;
}

/**
 * Dialog Footer Props
 */
export interface DialogFooterProps {
  /** Primary action button */
  primaryButton?: DialogButton;
  /** Secondary action button */
  secondaryButton?: DialogButton;
  /** Additional buttons */
  additionalButtons?: DialogButton[];
  /** Footer layout */
  layout?: DialogFooterLayout;
  /** Custom content (overrides buttons) */
  children?: ReactNode;
  /** Custom class name */
  className?: string;
  /** Show divider above footer */
  withDivider?: boolean;
}

/**
 * Composed Dialog Props (All-in-one)
 */
export interface ComposedDialogProps extends DialogProps {
  /** Header configuration */
  header?: Omit<DialogHeaderProps, 'onClose'>;
  /** Body configuration */
  body?: Omit<DialogBodyProps, 'children'>;
  /** Footer configuration */
  footer?: DialogFooterProps;
}
