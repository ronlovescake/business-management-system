import { redirect } from 'next/navigation';
import { getFirstAccessibleModule } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const firstModule = await getFirstAccessibleModule();

    if (firstModule) {
      redirect(firstModule);
    }

    // Fallback
    redirect('/clothing/operations');
  } catch (error) {
    // Handle redirect during build
    redirect('/clothing/operations');
  }
}

export const dynamic = 'force-dynamic';
