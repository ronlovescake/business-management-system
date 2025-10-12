'use client';

import React from 'react';
import { Card, Box } from '@mantine/core';

interface TableContainerProps {
  children: React.ReactNode;
  height?: string;
}

/**
 * Reusable Table Container Component
 *
 * Standard container for Mantine tables with:
 * - Bordered card wrapper
 * - Fixed height with scroll
 * - Consistent styling
 *
 * @param children - Table component to render
 * @param height - Container height (default: 71vh)
 */
export function TableContainer({
  children,
  height = '71vh',
}: TableContainerProps) {
  return (
    <Card withBorder padding={0} style={{ overflow: 'hidden', height }}>
      <Box style={{ height: '100%', overflowY: 'auto' }}>{children}</Box>
    </Card>
  );
}
