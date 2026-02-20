/**
 * Dispatching Page
 * Manage dispatching operations
 */

import type { Metadata } from 'next';
import { DispatchingRoutePage } from '@/app/operations/dispatching/_shared/DispatchingRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export const metadata: Metadata = {
  title: 'Dispatching - Business Management',
  description: 'Manage dispatching operations and tracking',
};

export default async function DispatchingPage() {
  return renderOperationsPage(
    '/clothing/operations/dispatching',
    <DispatchingRoutePage />
  );
}
