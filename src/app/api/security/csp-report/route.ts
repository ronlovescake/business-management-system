import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * CSP report-only endpoint. Browsers POST a JSON body describing each
 * violation triggered by the report-only Content-Security-Policy. We only
 * log here — there is no need to persist these reports to the DB. If
 * volumes get noisy, add rate limiting at the edge or filter known-noisy
 * directives below.
 *
 * Wired to the `report-uri` directive in next.config.js. Once the
 * report-only policy is promoted to enforced, this endpoint can stay or
 * be removed depending on whether ongoing telemetry is desired.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    // Keep the log payload small; CSP reports are noisy and we do not
    // want to blow up structured-log storage.
    // eslint-disable-next-line no-console
    console.warn('[csp-report]', JSON.stringify(body).slice(0, 1024));
  } catch {
    // Ignore malformed bodies — the browser sometimes sends odd shapes.
  }
  return new NextResponse(null, { status: 204 });
}

// Browsers may also use the newer Reporting API, which sends GET-like
// preflights; respond OK to avoid noisy CORS errors in devtools.
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}
