import { getSwal } from '@/lib/alerts';

type ConfirmCustomerReplaceParams = {
  previousCustomerInput: string;
  nextCustomer: string;
  source?: string | null;
};

export async function confirmCustomerReplacement({
  previousCustomerInput,
  nextCustomer,
  source,
}: ConfirmCustomerReplaceParams): Promise<boolean> {
  const Swal = await getSwal();
  const trimmedPrevious = previousCustomerInput.trim();
  const trimmedNext = nextCustomer.trim();
  const normalizedSource = String(source ?? '').toLowerCase();
  const isPasteSource =
    normalizedSource.includes('paste') || normalizedSource.includes('autofill');

  if (!isPasteSource) {
    return true;
  }

  if (!trimmedPrevious || !trimmedNext || trimmedPrevious === trimmedNext) {
    return true;
  }

  const result = await Swal.fire({
    title: 'Replace customer?',
    html: `Overwrite <b>${trimmedPrevious}</b> with <b>${trimmedNext}</b>?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Replace',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#d33',
    reverseButtons: true,
  });

  return result.isConfirmed === true;
}
