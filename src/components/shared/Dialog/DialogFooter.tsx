/**
 * DialogFooter Component
 *
 * Reusable footer component for dialogs with configurable
 * buttons and layout.
 */

import { Group, Button, Divider } from '@mantine/core';
import type { DialogFooterProps } from './Dialog.types';

export function DialogFooter({
  primaryButton,
  secondaryButton,
  additionalButtons = [],
  layout = 'flex-end',
  children,
  className,
  withDivider = true,
}: DialogFooterProps) {
  // If custom children provided, render that instead
  if (children) {
    return (
      <>
        {withDivider && <Divider my="md" />}
        <Group justify={layout} className={className}>
          {children}
        </Group>
      </>
    );
  }

  // Render configured buttons
  const buttons = [];

  // Add secondary button (typically "Cancel" or "Close")
  if (secondaryButton) {
    buttons.push(
      <Button
        key="secondary"
        variant={secondaryButton.variant || 'default'}
        color={secondaryButton.color}
        onClick={secondaryButton.onClick}
        disabled={secondaryButton.disabled}
        loading={secondaryButton.loading}
        fullWidth={secondaryButton.fullWidth}
        leftSection={secondaryButton.leftIcon}
        rightSection={secondaryButton.rightIcon}
      >
        {secondaryButton.label}
      </Button>
    );
  }

  // Add additional buttons
  additionalButtons.forEach((btn) => {
    const key = `additional-${btn.label ?? btn.variant ?? 'button'}`;
    buttons.push(
      <Button
        key={key}
        variant={btn.variant || 'light'}
        color={btn.color}
        onClick={btn.onClick}
        disabled={btn.disabled}
        loading={btn.loading}
        fullWidth={btn.fullWidth}
        leftSection={btn.leftIcon}
        rightSection={btn.rightIcon}
      >
        {btn.label}
      </Button>
    );
  });

  // Add primary button (typically "Save" or "Submit")
  if (primaryButton) {
    buttons.push(
      <Button
        key="primary"
        variant={primaryButton.variant || 'filled'}
        color={primaryButton.color}
        onClick={primaryButton.onClick}
        disabled={primaryButton.disabled}
        loading={primaryButton.loading}
        fullWidth={primaryButton.fullWidth}
        leftSection={primaryButton.leftIcon}
        rightSection={primaryButton.rightIcon}
      >
        {primaryButton.label}
      </Button>
    );
  }

  return (
    <>
      {withDivider && <Divider my="md" />}
      <Group justify={layout} className={className} mt="md">
        {buttons}
      </Group>
    </>
  );
}
