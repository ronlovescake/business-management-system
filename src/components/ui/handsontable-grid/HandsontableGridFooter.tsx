'use client';

import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';

interface HandsontableGridFooterProps {
  totalCount: number;
  filteredCount: number;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
}

export function HandsontableGridFooter({
  totalCount,
  filteredCount,
  footerLeft,
  footerRight,
}: HandsontableGridFooterProps) {
  return (
    <Group justify="space-between" align="center" style={{ marginTop: 'md' }}>
      <div>
        {footerLeft || (
          <Text size="sm" c="dimmed">
            {`Showing ${filteredCount} of ${totalCount} items`}
          </Text>
        )}
      </div>
      {footerRight ? (
        <div>
          {typeof footerRight === 'string' ? (
            <Text size="sm" c="dimmed">
              {footerRight}
            </Text>
          ) : (
            footerRight
          )}
        </div>
      ) : null}
    </Group>
  );
}
