import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listUsers, POST as createUser } from '@/app/api/users/route';
import {
  GET as getUser,
  PATCH as updateUser,
  DELETE as deleteUser,
} from '@/app/api/users/[id]/route';

const state = vi.hoisted(() => ({
  session: vi.fn(),
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('next-auth/next', () => ({ getServerSession: state.session }));
vi.mock('@/lib/auth/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/db', () => ({ prisma: { user: state.user } }));

const request = () =>
  new Request('http://localhost:5002/api/users/another-user');
const context = { params: { id: 'another-user' } };

describe('user administration authorization responses', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.user.findMany.mockResolvedValue([]);
  });

  it.each([
    [null, 401],
    ['USER', 403],
    ['ADMIN', 403],
  ] as const)(
    'rejects role %s with %s before any database access',
    async (role, status) => {
      state.session.mockResolvedValue(
        role ? { user: { id: 'actor', role } } : null
      );
      const responses = await Promise.all([
        listUsers(),
        createUser(request()),
        getUser(request(), context),
        updateUser(request(), context),
        deleteUser(request(), context),
      ]);
      expect(responses.map((response) => response.status)).toEqual(
        Array(5).fill(status)
      );
      for (const operation of Object.values(state.user)) {
        expect(operation).not.toHaveBeenCalled();
      }
    }
  );

  it('keeps super-admin listing available', async () => {
    state.session.mockResolvedValue({
      user: { id: 'actor', role: 'SUPER_ADMIN' },
    });
    expect((await listUsers()).status).toBe(200);
    expect(state.user.findMany).toHaveBeenCalledOnce();
  });

  it('does not disguise a database failure as an authorization denial', async () => {
    state.session.mockResolvedValue({
      user: { id: 'actor', role: 'SUPER_ADMIN' },
    });
    state.user.findMany.mockRejectedValue(new Error('Database unavailable'));
    expect((await listUsers()).status).toBe(500);
  });
});
