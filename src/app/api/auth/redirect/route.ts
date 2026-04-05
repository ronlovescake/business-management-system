import { redirect } from 'next/navigation';
import { getFirstAccessibleModule } from '@/lib/auth/permissions';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const firstModule = await getFirstAccessibleModule();

    if (firstModule) {
      redirect(firstModule);
    }

    // Fallback to homepage
    redirect('/');
  } catch (error) {
    // Handle redirect during build
    redirect('/');
  }
}
