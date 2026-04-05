import { redirect } from 'next/navigation';

export default function AdminBackupRestorePage() {
  redirect('/settings?tab=backup');
}
