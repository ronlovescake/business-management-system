import type { ReactNode } from 'react';
import { ClothingEmployeesThemeProvider } from '@/modules/clothing/employees/theme/ClothingEmployeesThemeProvider';

export default function ClothingLedgerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClothingEmployeesThemeProvider>{children}</ClothingEmployeesThemeProvider>
  );
}
