import type { ReactNode } from 'react';
import { ClothingEmployeesThemeProvider } from '@/modules/clothing/employees/theme/ClothingEmployeesThemeProvider';

export default function ClothingEmployeesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClothingEmployeesThemeProvider>{children}</ClothingEmployeesThemeProvider>
  );
}
