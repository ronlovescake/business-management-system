import type { ReactNode } from 'react';
import { memo } from 'react';
import { Card, Box } from '@mantine/core';

interface AccountingTableCardProps {
  children: ReactNode;
  height?: string;
  overflowX?: 'auto' | 'hidden' | 'scroll';
  overflowY?: 'auto' | 'hidden' | 'scroll';
}

export const AccountingTableCard = memo(function AccountingTableCard({
  children,
  height = '73vh',
  overflowX = 'hidden',
  overflowY = 'auto',
}: AccountingTableCardProps) {
  return (
    <Card withBorder padding={0} style={{ overflow: 'hidden', height }}>
      <Box style={{ height: '100%', overflowX, overflowY }}>{children}</Box>
    </Card>
  );
});
