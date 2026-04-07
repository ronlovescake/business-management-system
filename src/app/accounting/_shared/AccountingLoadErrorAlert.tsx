'use client';

import React from 'react';
import { Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

type AccountingLoadErrorAlertProps = {
  message: string | null;
};

export function AccountingLoadErrorAlert(props: AccountingLoadErrorAlertProps) {
  const { message } = props;

  if (!message) {
    return null;
  }

  return (
    <Alert
      color="red"
      icon={<IconAlertTriangle size={16} />}
      title="Accounting data failed to load"
      variant="light"
    >
      {message}
    </Alert>
  );
}
