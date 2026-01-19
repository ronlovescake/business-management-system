import React from 'react';
import { Modal, type ModalProps } from '@mantine/core';
import {
  polishedModalOverlayProps,
  polishedModalStyles,
} from './polishedModalTheme';

type PolishedModalProps = Omit<ModalProps, 'children'> & {
  children: React.ReactNode;
};

/**
 * Wrapper around Mantine's Modal that bakes in the polished styling used by the
 * leave tracker and other premium-feel dialogs. Consumers can still override any
 * Mantine prop, but sensible defaults ensure consistency out of the box.
 */
export function PolishedModal({
  children,
  radius = 'md',
  padding = 'xl',
  centered = true,
  closeOnClickOutside = false,
  closeOnEscape = false,
  overlayProps,
  styles,
  title,
  ...rest
}: PolishedModalProps) {
  const mergedOverlay = {
    ...polishedModalOverlayProps,
    ...overlayProps,
  };

  const mergedStyles = styles
    ? { ...polishedModalStyles, ...styles }
    : polishedModalStyles;

  const normalizedTitle =
    typeof title === 'string' ? title.toUpperCase() : title;

  return (
    <Modal
      radius={radius}
      padding={padding}
      centered={centered}
      closeOnClickOutside={closeOnClickOutside}
      closeOnEscape={closeOnEscape}
      overlayProps={mergedOverlay}
      styles={mergedStyles}
      title={normalizedTitle}
      {...rest}
    >
      {children}
    </Modal>
  );
}
