/**
 * Auth — User Profile API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/auth-and-access.md:
 *   #21 — Profile reads are self-service for the authenticated user
 *   #22 — Name changes and password changes share the profile-management surface
 *   #23 — Password changes require current-password verification
 *   #24 — New profile passwords must meet the minimum client-side rule set
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGetCurrentUser, mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { GET, PATCH } from '@/app/api/users/profile/route';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/users/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const USER = {
  id: 'user-1',
  email: 'alice@test.com',
  name: 'Alice',
  role: 'ADMIN',
  photoUrl: null,
  isActive: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Auth — User Profile API (Business Rules)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
    mockFindUnique.mockResolvedValue(USER);
    mockUpdate.mockResolvedValue(USER);
  });

  // Rule #21: Profile reads are self-service for the authenticated user
  it('Rule #21: GET returns the authenticated users own profile', async () => {
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe('user-1');
    expect(json.email).toBe('alice@test.com');
    // Must not expose password
    expect(json.password).toBeUndefined();
  });

  it('Rule #21: GET returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  // Rule #22: Name changes and password changes share the profile-management surface
  it('Rule #22: PATCH updates name only', async () => {
    const res = await PATCH(makeRequest({ name: 'Alice Updated' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toMatch(/profile updated/i);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Alice Updated' },
      })
    );
  });

  // Rule #23: Password changes require current-password verification
  it('Rule #23: rejects password change without current password', async () => {
    const res = await PATCH(makeRequest({ newPassword: 'NewPass123!' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/current password is required/i);
  });

  it('Rule #23: rejects password change with wrong current password', async () => {
    // findUnique returns user with hashed password
    mockFindUnique.mockResolvedValue({
      ...USER,
      password: '$2a$12$invalidhash000000000000000000000000000000000000000',
    });

    const res = await PATCH(
      makeRequest({
        currentPassword: 'WrongPassword',
        newPassword: 'NewPass123!',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/current password is incorrect/i);
  });

  // Rule #24: New passwords must meet minimum rule (6 char min via Zod)
  it('Rule #24: rejects new password shorter than 6 characters', async () => {
    const res = await PATCH(
      makeRequest({
        currentPassword: 'OldPass123',
        newPassword: '12345',
      })
    );
    expect(res.status).toBe(400);
  });

  // Auth guard
  it('PATCH returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ name: 'Updated' }));
    expect(res.status).toBe(401);
  });
});
