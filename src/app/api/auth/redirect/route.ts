import { redirect } from 'next/navigation';
import { getFirstAccessibleModule } from '@/lib/auth/permissions';

export async function GET() {
  const firstModule = await getFirstAccessibleModule();

  if (firstModule) {
    redirect(firstModule);
  }

  // Fallback
  redirect('/clothing/operations');
}
