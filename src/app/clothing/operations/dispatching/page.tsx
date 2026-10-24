import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dispatch - Business Management',
  description: 'Manage clothing dispatch operations',
};

export default function DispatchingPage() {
  redirect('/clothing/operations/dispatch');
}
