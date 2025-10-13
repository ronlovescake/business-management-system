/**
 * DialogBody Component
 *
 * Reusable body component for dialogs with optional
 * max height and scrolling.
 */

import { Box } from '@mantine/core';
import { DialogBodyProps } from './Dialog.types';

export function DialogBody({
  children,
  padding = 'md',
  className,
  maxHeight,
}: DialogBodyProps) {
  return (
    <Box
      p={padding}
      className={className}
      style={{
        maxHeight: maxHeight,
        overflowY: maxHeight ? 'auto' : undefined,
      }}
    >
      {children}
    </Box>
  );
}
