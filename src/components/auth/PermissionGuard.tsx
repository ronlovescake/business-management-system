'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { showCustomAlert } from '@/lib/alerts';

interface PermissionGuardProps {
  hasAccess: boolean;
  redirectTo: string | null;
  children: React.ReactNode;
}

export function PermissionGuard({
  hasAccess,
  redirectTo,
  children,
}: PermissionGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!hasAccess) {
      // Show alert and wait for user to click OK
      void showCustomAlert({
        title: 'Access Restricted',
        text: 'You do not have permission to access this page. Click OK to return to your dashboard.',
        icon: 'warning',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3b82f6',
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then((result) => {
        // Only redirect after user clicks OK
        if (result.isConfirmed) {
          if (redirectTo) {
            router.push(redirectTo);
          } else {
            router.push('/api/auth/redirect');
          }
        }
      });
    } else {
      setIsChecking(false);
    }
  }, [hasAccess, redirectTo, router]);

  // Don't render anything while checking or if no access
  if (isChecking || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}
