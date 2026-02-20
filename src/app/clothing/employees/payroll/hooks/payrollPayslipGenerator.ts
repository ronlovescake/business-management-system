import { logger } from '@/lib/logger';

interface GeneratePayslipsForPeriodParams {
  resolveApiPath: (path: string) => string;
  periodStart: string;
  periodEnd: string;
  payPeriodLabel: string;
}

type GeneratePayslipsResult =
  | { success: true }
  | { success: false; error: string };

export async function generatePayrollPayslipsForPeriod({
  resolveApiPath,
  periodStart,
  periodEnd,
  payPeriodLabel,
}: GeneratePayslipsForPeriodParams): Promise<GeneratePayslipsResult> {
  const response = await fetch(resolveApiPath('/payroll/generate-payslips'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      periodStart,
      periodEnd,
      payPeriodLabel,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    const message = errorData?.error || 'Failed to generate payslips.';
    return {
      success: false,
      error: message,
    };
  }

  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'Payslip download is only available in the browser.',
    };
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const contentDisposition = response.headers.get('Content-Disposition');

  let filename = `payslips-${periodEnd.replace(/[^0-9]/g, '') || 'export'}.zip`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
    );
    if (filenameMatch && filenameMatch[1]) {
      filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
    }
  }

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return {
    success: true,
  };
}

export function getPayrollPayslipDownloadError(error: unknown): string {
  logger.error('Error generating payslips:', error);

  return error instanceof Error && error.message
    ? error.message
    : 'Failed to download payslips. Please try again.';
}
