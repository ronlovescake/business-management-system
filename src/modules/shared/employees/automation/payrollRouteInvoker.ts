import { NextRequest } from 'next/server';
import type { EmployeeAutomationExecutionResult } from './types';

type PayrollRouteDomain = 'clothing' | 'trucking' | 'general-merchandise';

function isSkippedPayrollMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already exists for period') ||
    normalized.includes('no attendance records found') ||
    normalized.includes('no eligible employees') ||
    normalized.includes('already exists for this period')
  );
}

function toExecutionResult(
  body: Record<string, unknown>,
  responseOk: boolean,
  period: { periodStart: string; periodEnd: string; periodKey: string }
): EmployeeAutomationExecutionResult {
  const nestedData =
    body.data && typeof body.data === 'object'
      ? (body.data as Record<string, unknown>)
      : null;

  const count =
    typeof nestedData?.count === 'number'
      ? nestedData.count
      : typeof body.count === 'number'
        ? body.count
        : 0;

  const message =
    (typeof body.message === 'string' && body.message) ||
    (typeof body.error === 'string' && body.error) ||
    (typeof body.details === 'string' && body.details) ||
    'Payroll automation completed.';

  if (responseOk && body.success === true) {
    return {
      automationType: 'payroll-generation',
      status: 'success',
      message,
      processed: count,
      inserted: count,
      skipped: 0,
      periodKey: period.periodKey,
      payrollPeriodStart: period.periodStart,
      payrollPeriodEnd: period.periodEnd,
      metadata: body,
    };
  }

  return {
    automationType: 'payroll-generation',
    status: isSkippedPayrollMessage(message) ? 'skipped' : 'error',
    message,
    processed: count,
    inserted: 0,
    skipped: 0,
    periodKey: period.periodKey,
    payrollPeriodStart: period.periodStart,
    payrollPeriodEnd: period.periodEnd,
    metadata: body,
  };
}

export async function invokePayrollGenerationRoute(params: {
  domain: PayrollRouteDomain;
  periodStart: string;
  periodEnd: string;
  label: string;
  periodKey: string;
}): Promise<EmployeeAutomationExecutionResult> {
  const request = new NextRequest(
    `http://localhost/api/${params.domain}/payroll/generate`,
    {
      method: 'POST',
      body: JSON.stringify({
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        payPeriodLabel: params.label,
      }),
      headers: {
        'content-type': 'application/json',
      },
    }
  );

  if (params.domain === 'trucking') {
    const { POST } = await import('@/app/api/trucking/payroll/generate/route');
    const response = await POST(request as never);
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return toExecutionResult(body, response.ok, params);
  }

  if (params.domain === 'general-merchandise') {
    const { POST } = await import(
      '@/app/api/general-merchandise/payroll/generate/route'
    );
    const response = await POST(request);
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return toExecutionResult(body, response.ok, params);
  }

  const { POST } = await import('@/app/api/payroll/generate/route');
  const response = await POST(request);
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return toExecutionResult(body, response.ok, params);
}
