/**
 * Auth — Password Forgot API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/auth-and-access.md:
 *   #15 — Forgot-password does not reveal whether a user exists
 *   #16 — Reset requests are rate-limited by cooldown
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---- hoisted mocks ----

const {
  mockFindUnique,
  mockGeneratePasswordResetToken,
  mockGetLatestResetRequest,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockGeneratePasswordResetToken: vi.fn(),
  mockGetLatestResetRequest: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock('@/lib/auth/password-reset', () => ({
  generatePasswordResetToken: mockGeneratePasswordResetToken,
  getLatestResetRequest: mockGetLatestResetRequest,
  PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES: 2,
}));

vi.mock('@/lib/email/mailer', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/lib/env', () => ({
  getBaseUrl: () => 'http://localhost:3000',
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { POST } from '@/app/api/auth/password/forgot/route';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/auth/password/forgot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const GENERIC_MESSAGE =
  'If an account exists for this email, a password reset link has been sent.';

describe('Auth — Forgot Password API (Business Rules)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(undefined);
    mockGeneratePasswordResetToken.mockResolvedValue({
      token: 'raw-token-abc',
      expiresAt: new Date('2026-04-08T12:30:00.000Z'),
      recordId: 'record-1',
    });
    mockGetLatestResetRequest.mockResolvedValue(null);
  });

  // Rule #15: Forgot-password does not reveal whether a user exists
  it('Rule #15: returns generic message for nonexistent user (no user enumeration)', async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: 'nobody@test.com' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(GENERIC_MESSAGE);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('Rule #15: returns generic message for inactive user (no user enumeration)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1',
      email: 'inactive@test.com',
      isActive: false,
      deletedAt: null,
    });

    const res = await POST(makeRequest({ email: 'inactive@test.com' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(GENERIC_MESSAGE);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('Rule #15: returns generic message for soft-deleted user', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u2',
      email: 'deleted@test.com',
      isActive: true,
      deletedAt: new Date(),
    });

    const res = await POST(makeRequest({ email: 'deleted@test.com' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(GENERIC_MESSAGE);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('Rule #15: returns same generic message for a valid user (indistinguishable)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u3',
      email: 'valid@test.com',
      name: 'Valid User',
      isActive: true,
      deletedAt: null,
    });

    const res = await POST(makeRequest({ email: 'valid@test.com' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(GENERIC_MESSAGE);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  // Rule #16: Reset requests are rate-limited by cooldown
  it('Rule #16: rate-limits with 429 when last reset was within cooldown', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u3',
      email: 'valid@test.com',
      isActive: true,
      deletedAt: null,
    });
    mockGetLatestResetRequest.mockResolvedValue({
      createdAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago (within 2-minute cooldown)
    });

    const res = await POST(makeRequest({ email: 'valid@test.com' }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toMatch(/reset email/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('Rule #16: allows reset when cooldown has elapsed', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u3',
      email: 'valid@test.com',
      name: 'Valid',
      isActive: true,
      deletedAt: null,
    });
    mockGetLatestResetRequest.mockResolvedValue({
      createdAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago (past cooldown)
    });

    const res = await POST(makeRequest({ email: 'valid@test.com' }));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  // Validation
  it('rejects invalid email format with 400', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });
});
