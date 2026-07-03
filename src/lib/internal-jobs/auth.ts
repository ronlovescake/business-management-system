import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type InternalTokenErrorBody = Record<string, unknown>;

type RequireInternalTokenOptions = {
  missingTokenBody?: InternalTokenErrorBody;
  unauthorizedBody?: InternalTokenErrorBody;
  unauthorizedHeaders?: HeadersInit;
};

const DEFAULT_MISSING_TOKEN_BODY = {
  success: false,
  error: 'INTERNAL_JOB_TOKEN is not configured on the server',
};

const DEFAULT_UNAUTHORIZED_BODY = {
  success: false,
  error: 'Unauthorized',
};

const DEFAULT_UNAUTHORIZED_HEADERS = {
  'WWW-Authenticate': 'Bearer',
};

export function requireInternalToken(
  request: NextRequest,
  options: RequireInternalTokenOptions = {}
): NextResponse | null {
  const expected = (process.env.INTERNAL_JOB_TOKEN || '').trim();
  if (!expected) {
    return NextResponse.json(
      options.missingTokenBody ?? DEFAULT_MISSING_TOKEN_BODY,
      { status: 500 }
    );
  }

  const provided = (request.headers.get('x-internal-token') || '').trim();
  if (!provided || provided !== expected) {
    return NextResponse.json(
      options.unauthorizedBody ?? DEFAULT_UNAUTHORIZED_BODY,
      {
        status: 401,
        headers: options.unauthorizedHeaders ?? DEFAULT_UNAUTHORIZED_HEADERS,
      }
    );
  }

  return null;
}
