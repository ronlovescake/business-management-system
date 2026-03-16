import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useCashAdvance as useCashAdvanceBase } from '@/app/clothing/employees/cash-advance/hooks/useCashAdvance';

export {
  calculateMonthlyPayment,
  type EmployeeOption,
} from '@/app/clothing/employees/cash-advance/hooks/useCashAdvance';

export function useCashAdvance() {
  const { data: session } = useSession();

  const currentUserName = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (name) {
      return name;
    }

    const email = session?.user?.email?.trim();
    if (email) {
      return email;
    }

    return 'Current User';
  }, [session?.user?.name, session?.user?.email]);

  return useCashAdvanceBase('/api/trucking', { currentUserName });
}
