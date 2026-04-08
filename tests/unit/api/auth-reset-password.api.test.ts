/**
 * Auth — Password Reset API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/auth-and-access.md:
 *   #17 — Reset tokens are random, hashed, and time-limited
 *   #19 — Reset completion requires a valid, unused, unexpired token
 *   #20 — Completing a reset consumes the token and revokes sibling active tokens
 *   #24 — New profile passwords must meet the minimum client-side rule set (6 char min)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockFindValidPasswordResetToken,
  mockMarkPasswordResetTokenConsumed,
  mockRevokeOtherActiveResetTokens,
  mockUserUpdate,
} = vi.hoisted(() => ({
  mockFindValidPasswordResetToken: vi.fn(),
  mockMarkPasswordResetTokenConsumed: vi.fn(),
  mockRevokeOtherActiveResetTokens: vi.fn(),
  mockUserUpdate: vi.fn(),
}));

vi.mock('@/lib/auth/password-reset', () => ({
  findValidPasswordResetToken: mockFindValidPasswordResetToken,
  markPasswordResetTokenConsumed: mockMarkPasswordResetTokenConsumed,
  revokeOtherActiveResetTokens: mockRevokeOtherActiveResetTokens,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: mockUserUpdate,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { POST } from '@/app/api/auth/password/reset/route';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_TOKEN = 'a'.repeat(64);

describe('Auth — Password Reset API (Business Rules)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserUpdate.mockResolvedValue({});
    mockMarkPasswordResetTokenConsumed.mockResolvedValue({});
    mockRevokeOtherActiveResetTokens.mockResolvedValue({});
  });

  // Rule #19: Reset completion requires a valid, unused, unexpired token
  it('Rule #19: rejects reset when token is invalid/expired/consumed', async () => {
    mockFindValidPasswordResetToken.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ token: VALID_TOKEN, password: 'NewPass123!' })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid or has expired/i);
  });

  it('Rule #19: accepts reset with a valid, unused, unexpired token', async () => {
    mockFindValidPasswordResetToken.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      user: { id: 'user-1', email: 'test@test.com' },
    });

    const res = await POST(
      makeRequest({ token: VALID_TOKEN, password: 'NewPass123!' })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toMatch(/password updated/i);
  });

  // Rule #20: Completing a reset consumes the token and revokes sibling tokens
  it('Rule #20: consumes the token after successful reset', async () => {
    mockFindValidPasswordResetToken.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      user: { id: 'user-1' },
    });

    await POST(makeRequest({ token: VALID_TOKEN, password: 'NewPass123!' }));

    expect(mockMarkPasswordResetTokenConsumed).toHaveBeenCalledWith('token-1');
  });

  it('Rule #20: revokes other active tokens for the same user', async () => {
    mockFindValidPasswordResetToken.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      user: { id: 'user-1' },
    });

    await POST(makeRequest({ token: VALID_TOKEN, password: 'NewPass123!' }));

    expect(mockRevokeOtherActiveResetTokens).toHaveBeenCalledWith({
      userId: 'user-1',
      excludeTokenId: 'token-1',
    });
  });

  // Rule #24: Password must meet minimum rule set (6 char min)
  it('Rule #24: rejects password shorter than 6 characters', async () => {
    const res = await POST(
      makeRequest({ token: VALID_TOKEN, password: '12345' })
    );
    expect(res.status).toBe(400);
  });

  // Rule #17: Token must be >= 32 characters
  it('Rule #17: rejects token shorter than 32 characters', async () => {
    const res = await POST(
      makeRequest({ token: 'short', password: 'ValidPass123!' })
    );
    expect(res.status).toBe(400);
  });

  // Password hashing: new password is hashed before storage
  it('hashes the new password before updating the user record', async () => {
    mockFindValidPasswordResetToken.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      user: { id: 'user-1' },
    });

    await POST(makeRequest({ token: VALID_TOKEN, password: 'NewPass123!' }));

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          password: expect.not.stringContaining('NewPass123!'), // must be hashed
        }),
      })
    );
  });
});
