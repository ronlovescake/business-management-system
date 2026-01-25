'use client';

import { Box } from '@mantine/core';
import { ChangeLogPage } from '@/modules/clothing/operations/settings/change-log';

export function ChangeLogTab({ apiBasePath }: { apiBasePath?: string }) {
  return (
    <Box>
      <ChangeLogPage apiBasePath={apiBasePath} />
    </Box>
  );
}
