'use client';

import { Button } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { signOut } from 'next-auth/react';

export function LogoutButton() {
  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <Button
      variant="subtle"
      color="red"
      leftSection={<IconLogout size={18} />}
      onClick={handleLogout}
    >
      Logout
    </Button>
  );
}
