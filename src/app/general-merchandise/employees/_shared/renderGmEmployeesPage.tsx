import type { ReactNode } from 'react';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export async function renderGmEmployeesPage(
  modulePath: string,
  children: ReactNode
) {
  return renderOperationsPage(modulePath, children);
}
